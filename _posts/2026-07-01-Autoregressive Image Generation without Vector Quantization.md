---
title: Autoregressive Image Generation without Vector Quantization
date: 2026-07-01 00:00:30 +0800
categories:
  - 生成模型
tags: [自回归, 图像生成]
---
## 参考文章 [(4 条消息) 解读何恺明新作：不用向量离散化的自回归图像生成（Autoregressive Image Generation without Vector Quantization） - 知乎](https://zhuanlan.zhihu.com/p/710748815)
自回归是一种根据之前已生成内容，不断递归预测下一项要生成的内容的生成模型。这种生成方式十分易懂，符合我们对生活的观察。比如我们希望模型生成一句话，第一个是「今」字，那么第二个字很可能就是「天」字。如果前三个字是「今天早」，那么第四个字就很可能是「上」。

为这种自回归模型的而设计的 Transformer 网络在自然语言处理（NLP）中取得了极大的成功。然而，尽管许多人也尝试用它生成图像，自回归模型却一直没有成为最强大、最受欢迎的图像生成模型。

为了解决此问题，何恺明团队公布了论文 Autoregressive Image Generation without Vector Quantization。**作者分析了目前最常见的自回归图像生成模型后，发现模型中的向量离散化 (Vector Quantization, VQ) 是拖累模型能力的罪魁祸首**。作者用一些巧妙的方法绕过了 VQ，最终设计出了一种新式自回归模型。该模型在图像生成任务上表现出色，在 ImageNet 图像生成指标上不逊于最先进的图像扩散模型。在这篇博文中，我们就来学习一下这种新颖的无 VQ 自回归图像生成模型。 