export const blackholeFragmentShader = `
#define PI 3.141592653589793238462643383279
#define DEG_TO_RAD (PI/180.0)
#define ROT_Z(a) mat3(cos(a), -sin(a), 0, sin(a), cos(a), 0, 0, 0, 1)

#ifndef STEP
#define STEP 0.05
#endif

#ifndef NSTEPS
#define NSTEPS 600
#endif

uniform float time;
uniform vec2 resolution;
uniform vec3 cam_pos;
uniform vec3 cam_dir;
uniform vec3 cam_up;
uniform float fov;
uniform vec3 cam_vel;
uniform bool accretion_disk;
uniform bool use_disk_texture;
uniform bool doppler_shift;
uniform bool lorentz_transform;
uniform bool beaming;
uniform sampler2D bg_texture;
uniform sampler2D star_texture;
uniform sampler2D disk_texture;

const float MIN_TEMPERATURE = 1000.0;
const float TEMPERATURE_RANGE = 39000.0;
const float DISK_IN = 2.0;
const float DISK_WIDTH = 4.0;

vec2 square_frame(vec2 screen_size){
  vec2 position = 2.0 * (gl_FragCoord.xy / screen_size.xy) - 1.0;
  return position;
}

vec2 to_spherical(vec3 cartesian_coord){
  vec2 uv = vec2(atan(cartesian_coord.z,cartesian_coord.x), asin(cartesian_coord.y));
  uv *= vec2(1.0/(2.0*PI), 1.0/PI);
  uv += 0.5;
  return uv;
}

vec3 lorentz_transform_velocity(vec3 u, vec3 v){
  float speed = length(v);
  if (speed > 0.0){
    float gamma = 1.0/sqrt(1.0-dot(v,v));
    float denominator = 1.0 - dot(v,u);
    vec3 new_u = (u/gamma - v + (gamma/(gamma+1.0)) * dot(u,v)*v)/denominator;
    return new_u;
  }
  return u;
}

vec3 temp_to_color(float temp_kelvin){
  vec3 color;
  temp_kelvin = clamp(temp_kelvin, 1000.0, 40000.0) / 100.0;
  if (temp_kelvin <= 66.0){
    color.r = 255.0;
    color.g = temp_kelvin;
    color.g = 99.4708025861 * log(color.g) - 161.1195681661;
    color.g = clamp(color.g, 0.0, 255.0);
  } else {
    color.r = temp_kelvin - 60.0;
    color.r = 329.698727446 * pow(max(color.r, 0.0), -0.1332047592);
    color.r = clamp(color.r, 0.0, 255.0);
    color.g = temp_kelvin - 60.0;
    color.g = 288.1221695283 * pow(max(color.g, 0.0), -0.0755148492);
    color.g = clamp(color.g, 0.0, 255.0);
  }
  if (temp_kelvin >= 66.0){
    color.b = 255.0;
  } else if (temp_kelvin <= 19.0){
    color.b = 0.0;
  } else {
    color.b = temp_kelvin - 10.0;
    color.b = 138.5177312231 * log(color.b) - 305.0447927307;
    color.b = clamp(color.b, 0.0, 255.0);
  }
  color /= 255.0;
  return color;
}

void main() {
  float uvfov = tan(fov / 2.0 * DEG_TO_RAD);
  vec2 uv = square_frame(resolution);
  uv *= vec2(resolution.x/resolution.y, 1.0);

  vec3 forward = normalize(cam_dir);
  vec3 up = normalize(cam_up);
  vec3 nright = normalize(cross(forward, up));
  up = cross(nright, forward);

  vec3 pixel_pos = cam_pos + forward + nright * uv.x * uvfov + up * uv.y * uvfov;
  vec3 ray_dir = normalize(pixel_pos - cam_pos);

  if (lorentz_transform) {
    ray_dir = lorentz_transform_velocity(ray_dir, cam_vel);
  }

  vec4 color = vec4(0.0,0.0,0.0,1.0);
  vec3 point = cam_pos;
  vec3 velocity = ray_dir;
  vec3 c = cross(point,velocity);
  float h2 = dot(c,c);

  float ray_gamma = 1.0/sqrt(1.0-dot(cam_vel,cam_vel));
  float ray_doppler_factor = ray_gamma * (1.0 + dot(ray_dir, -cam_vel));
  float ray_intensity = beaming ? 1.0 / pow(ray_doppler_factor, 3.0) : 1.0;

  vec3 oldpoint;
  float distance = length(point);

  for (int i=0; i<NSTEPS; i++) {
    oldpoint = point;
    point += velocity * STEP;
    vec3 accel = -1.5 * h2 * point / pow(dot(point,point),2.5);
    velocity += accel * STEP;
    distance = length(point);

    bool horizon_mask = distance < 1.0 && length(oldpoint) > 1.0;
    if (horizon_mask) {
      break;
    }

    if (accretion_disk && oldpoint.y * point.y < 0.0) {
      float lambda = - oldpoint.y/velocity.y;
      vec3 intersection = oldpoint + lambda*velocity;
      float r = length(intersection);

      if (DISK_IN <= r && r <= DISK_IN + DISK_WIDTH) {
        float phi = atan(intersection.x, intersection.z);
        vec3 disk_velocity = vec3(-intersection.x, 0.0, intersection.z)/sqrt(2.0*(r-1.0))/(r*r);
        phi -= time;
        phi = mod(phi , PI*2.0);
        float disk_gamma = 1.0/sqrt(1.0-dot(disk_velocity, disk_velocity));
        float disk_doppler_factor = disk_gamma*(1.0+dot(ray_dir/distance, disk_velocity));

        if (use_disk_texture) {
          vec2 tex_coord = vec2(mod(phi,2.0*PI)/(2.0*PI),1.0-(r-DISK_IN)/(DISK_WIDTH));
          vec4 disk_color = texture2D(disk_texture, tex_coord) / (ray_doppler_factor * disk_doppler_factor);
          float disk_alpha = clamp(dot(disk_color,disk_color)/4.5,0.0,1.0);
          if (beaming) {
            disk_alpha /= pow(disk_doppler_factor,3.0);
          }
          color += vec4(disk_color) * disk_alpha;
        } else {
          float disk_temperature = 10000.0 * pow(r / DISK_IN, -3.0 / 4.0);
          if (doppler_shift) {
            disk_temperature /= ray_doppler_factor * disk_doppler_factor;
          }
          vec3 disk_color = temp_to_color(disk_temperature);
          float disk_alpha = clamp(dot(disk_color,disk_color)/3.0,0.0,1.0);
          if (beaming) {
            disk_alpha /= pow(disk_doppler_factor,3.0);
          }
          color += vec4(disk_color, 1.0) * disk_alpha;
        }
      }
    }
  }

  if (distance > 1.0) {
    ray_dir = normalize(point - oldpoint);
    vec2 tex_coord = to_spherical(ray_dir * ROT_Z(45.0 * DEG_TO_RAD));
    vec4 star_color = texture2D(star_texture, tex_coord);

    if (star_color.g > 0.0){
      float star_temperature = MIN_TEMPERATURE + TEMPERATURE_RANGE * star_color.r;
      float star_velocity = star_color.b - 0.5;
      float star_doppler_factor = sqrt((1.0+star_velocity)/(1.0-star_velocity));
      if (doppler_shift) {
        star_temperature /= ray_doppler_factor * star_doppler_factor;
      }
      color += vec4(temp_to_color(star_temperature),1.0) * star_color.g;
    }

    color += texture2D(bg_texture, tex_coord) * 0.25;
  }

  gl_FragColor = color * ray_intensity;
}
`;

export const blackholeVertexShader = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

export const getBlackholeShaderDefines = (quality: 'low' | 'medium') => {
  switch (quality) {
    case 'low':
      return '#define STEP 0.1\n#define NSTEPS 300\n';
    default:
      return '#define STEP 0.05\n#define NSTEPS 600\n';
  }
};
