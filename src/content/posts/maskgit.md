---
title: "MaskGIT: Masked Generative Image Transformer"
published: 2026-07-01
description: MaskGIT是Google
  2022年提出的，专门针对VQGAN那种"自回归Transformer采样太慢"的问题做的改进。核心思路是把BERT的MLM(掩码预测)机制搬到图像token生成上，用"并行迭代解码"代替"
tags:
  - maskgit
  - bert
  - 双向注意力
  - 迭代解码
  - 图像生成
  - google
category: 生成模型
draft: false
---

MaskGIT是Google 2022年提出的，专门针对VQGAN那种"自回归Transformer采样太慢"的问题做的改进。核心思路是把BERT的MLM(掩码预测)机制搬到图像token生成上，用"并行迭代解码"代替"逐个token自回归解码"。你看完会发现它和BERT的联系比GPT更紧密。

## 先说直觉

自回归Transformer(VQGAN那种)生成一张16×16=256个token的图,要串行采样256次,每次只能定1个token,慢。

MaskGIT的想法:能不能像BERT做完形填空一样,一次性并行预测所有被mask的token,然后只保留"预测置信度最高"的一部分,其余重新mask掉,下一轮再基于已确定的token去预测剩下的?这样迭代8~12轮就能生成全部256个token,比256步快十几倍到几十倍。

## 训练:和BERT的MLM几乎一模一样

**结构**:Encoder-only的双向Transformer(没有causal mask!这是和GPT风格VQGAN Transformer最大的结构区别)

**训练步骤**:

1. 图像先经过VQGAN的Encoder+VQ,得到 $h \times w$ 个离散token,拉成序列 $Y = \{y_i\}_{i=1}^N$ (比如N=256)

2. 随机采样一个mask比例 $\gamma(r)$,其中 $r \in [0,1]$ 从均匀分布采样,$\gamma$ 是一个调度函数(论文用的是cosine函数: $\gamma(r) = \cos(\frac{\pi r}{2})$ )。这一步很关键,意味着每次训练样本被mask的比例是随机的,可能这次mask 90%,下次mask 10%,不像BERT固定15%

3. 按这个比例随机选一部分位置,把对应token替换成特殊符号 `[MASK]`,得到 $Y_M$

4. 把 $Y_M$ 整个序列(mask的+没mask的一起)输入双向Transformer,每个位置能看到序列里所有其他位置(没有causal mask,这点完全是BERT的做法)

5. 训练目标:只对**被mask掉的那些位置**计算交叉熵损失,预测它们原本的token是什么:

$$\mathcal{L}_{mask} = -\mathbb{E}_{Y}\left[\sum_{i: y_i \text{被mask}} \log p(y_i \mid Y_M)\right]$$

(没被mask的位置不计入loss,这和BERT MLM完全一致)

**和BERT MLM的区别**:BERT固定15%的mask比例,MaskGIT用动态随机的mask比例(从接近0%到接近100%都会训练到),这是因为MaskGIT推理时要做从全mask逐步到全部揭晓的多轮迭代,所以训练时必须让模型见过"各种mask比例"下该怎么预测,而不只是15%这一种情况。

## 推理:并行迭代解码(Iterative Parallel Decoding)——这是MaskGIT的核心创新

假设总共要解码 $N=256$ 个token,分 $T$ 轮(论文里 $T=8$ 或 $12$)完成,不是一次到位。

**初始化**:序列全部是 `[MASK]`,即 $Y^{(0)}_M$ = 全mask

**第 $t$ 轮迭代**(从 $t=1$ 到 $T$):

1. **预测(Predict)**:把当前序列 $Y^{(t-1)}_M$ (部分token已确定,部分还是mask)输入Transformer,对所有仍是mask的位置,并行输出它们在codebook上的概率分布

2. **采样(Sample)**:对每个mask位置,从预测的分布中采样一个token,同时记录这个token被采到的**置信度分数**(即该token在分布里的概率值,也叫"预测置信度")

3. **确定本轮要保留几个token**(Mask Schedule):根据调度函数计算这一轮"应该揭晓"多少比例的token

$$n = \lceil \gamma(t/T) \cdot N \rceil$$

$\gamma$ 是递减的(比如同样用cosine schedule),意味着第一轮mask比例最高(保留最少),最后一轮mask比例趋近0(全部揭晓)

4. **筛选置信度最高的token**(Confidence-based selection):在所有本轮新采样出来的token里,按置信度从高到低排序,只保留最有把握的那一部分,把它们"钉死"(设为已确定,后续轮次不再改变);其余置信度低的token重新变回 `[MASK]`,留到下一轮再预测

直觉:模型对某些位置很有把握(比如大片天空、纯色背景),这些应该早早确定下来;对细节丰富、有歧义的位置(比如人脸五官),模型没把握,就先不要急着定,让后面的轮次在已经有更多上下文信息时再来决定,这样预测会更准

5. 更新序列 $Y^{(t)}_M$ = (已确定的token) + (仍是mask的token),进入下一轮

重复 $T$ 轮后,所有位置全部揭晓,得到完整的256个token序列 → 查codebook拿embedding网格 → Decoder生成图像。

## 和自回归方式的对比

| 特性 | PixelCNN | VQGAN-Transformer(GPT式) | MaskGIT |
|------|----------|-------------------------|---------|
| Attention方式 | 局部卷积+mask | causal self-attention(单向) | 双向self-attention(无causal mask) |
| 训练目标 | 预测下一个像素/token | 预测下一个token(自回归) | 预测被mask的token(类BERT MLM) |
| 采样顺序 | 固定光栅扫描,逐个 | 固定序列顺序,逐个 | 无固定顺序,每轮并行预测多个,按置信度筛选 |
| 采样步数 | N步(N=token总数) | N步 | T步(T远小于N,如T=8~12) |
| 每步能确定几个token | 1个 | 1个 | 多个(数量逐轮递减) |
| 生成速度 | 慢 | 慢 | 快很多(实测比自回归快10-30倍) |
| 生成质量 | 一般 | 好 | 相当甚至更好(因为双向上下文比单向causal能看到更全的信息做决策) |

## 一句话总结三者关系

- **PixelCNN → VQGAN-Transformer**:都是自回归(GPT式)范式,只是把局部卷积换成了全局attention,解决"建模能力不足"的问题,但没解决"串行采样慢"的问题
- **MaskGIT**:换了一个完全不同的范式——用BERT式的双向MLM训练,配合"预测→筛选置信度→部分揭晓→迭代"的推理流程,直接从根本上解决了"必须逐个token串行生成"这个自回归模型的固有瓶颈,用固定的少数几轮(T轮)就能生成整个token序列,是牺牲一点点"生成时严格的自回归因果建模",换来大幅的推理加速。
