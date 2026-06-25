---
title: 玩个游戏还要手撕 Dll
time: 20260625
des: 像手撕马奇诺防线一样手撕 Dll
tags: ['反编译', '记录', '游戏']
---

## 像手撕马奇诺防线一样手撕 Dll

~~我们拥有雄鹰一般的语言能力~~

是的, 没听错, 动态链接库(Dll)实际上不堪一击, 连 MC 世界的史蒂夫都能手撕动态链接库!

### 为什么要手撕 Dll

这得回到昨天(20260624)了.

我的父亲突然说, 想玩星际争霸了, 并且还是一代, 恰好前几天是父亲节, 于是我想到要不要把星际争霸下回来让我父亲开心开心.

在网络上一搜, 什么游侠网啊, CSDN(没听错)啊都有相关的教程和下载链接, 我一开始在游侠网下载, 但是发现安装出来的是**星际争霸安装助手**.

再一看, 扫码付费 28.8, 支持支付宝和微信付款, 当即我就认为这是圈钱的, 然后记住这个圈钱 UI, 让悲剧不再发生.

之后再在网络上搜索, 发现大部分直链下载的被圈钱的~~狗~~软件包圆了

经过漫长的寻找, 最终还是在贴吧里的一个2018年的帖子上找到了 1.08 超级老版本. 我寻思着能玩就行.

解压 -> 设置兼容性 -> 关闭全屏优化 -> 用管理员身份运行.

我本以为会如红色警戒那样直接开玩, 结果:

> Data File Error
>
> Starcraft is unable to read a required file. Your Starcraft CD may not be in the CDROM drive. Please ensure that the Starcraft disc is in the CDROM drive and press OK.

我当时想着, 看来是没打 `免CD补丁` 啊, 我寻思着网上应该有吧...结果你猜怎么着: 基本找不到, 或者已经过期了/不适用 1.08.

当时一怒之下怒了一下, 开始琢磨有没有什么办法能手动绕过 CD 检测.

### 如何手撕 Dll

这里要分两种, 一种是 C# .NET, 一种是使用诸如 C/Cpp, Rust, Go 这类编译型语言编译出来的.

C# .NET 比较好处理, 扔进 `dnspy`, 如果没有加密的话可以直接导出为源代码.

但是 C/Cpp 这类就比较麻烦了, 简单点的, 例如早期游戏, 星际争霸1, 需要用十六进制编辑器 (比如 `Hexeditor`)

找到 storm.dll, 用十六进制编辑器(如 HxD、UltraEdit、010 Editor)打开, 先备份原文件, 然后搜索十六进制字节序列:

`66 81 F9 00 1F 74 0B 66 81`

找到后把其中的 `74`(JE 跳转)改成 `EB`(无条件 JMP), 即变成:

`66 81 F9 00 1F EB 0B 66 81`

保存, 再运行 `StarCraft.exe` 就不会再弹 "unable to read a required file / insert CD" 了.

顺带一提, 部分版本还需要确认注册表里` HKLM\Software\Blizzard Entertainment\Starcraft` 下有 `"StarCD"="C:\"`(指向你的安装盘符), 不过大多数 1.08 硬盘版只 Patch 这一字节就够了.

对于这类没加壳的 C/C++ 原生 DLL/EXE, "手撕"的一般套路是:

1. 定位——用调试器(x64dbg/x32dbg、OllyDbg)或 API 断点(GetDriveTypeA、GetVolumeInformationA)找到光盘校验的逻辑, 通常是一对 CMP + JE/JZ/JNZ.
2. Patch——把条件跳转改成 JMP(机器码 EB)或直接 NOP 掉(90), 记下对应的字节.
3. 固化——用 Hex 编辑器按偏移找到对应字节改掉存盘, 或者直接用调试器的"保存到文件"功能.
