---
title: Transformer、BERT、GPT的训练和推理
published: 2026-07-02
description: 这是2017年"Attention is All You Need"提出的结构，典型任务是机器翻译（比如中文→英文）。
tags:
  - transformer
  - bert
  - gpt
  - 注意力机制
  - 预训练
category: 生成模型
draft: false
---

## 一、原始Transformer（Encoder-Decoder，做机器翻译）

这是2017年"Attention is All You Need"提出的结构，典型任务是**机器翻译**（比如中文→英文）。

### 结构

- **Encoder**：N层堆叠，每层 = Self-Attention + FFN（前馈网络），双向的（没有mask，每个位置能看到句子里所有位置）
- **Decoder**：N层堆叠，每层 = **Masked** Self-Attention + **Cross-Attention**（attend Encoder输出）+ FFN

### 训练

假设中译英，"我爱你" → "I love you"

1. **Encoder输入**：完整的源语言句子"我爱你"，双向attention，输出每个位置的上下文表示（这些表示会被Decoder的cross-attention用到）
2. **Decoder输入**：目标语言句子，但**整体右移一位**，前面加一个起始符 `<BOS>`，即输入是 `<BOS> I love you`
3. **Decoder的Masked Self-Attention**：用causal mask保证位置 $i$ 只能看到 $\le i$ 的位置（不能偷看未来的词）
4. **Decoder的Cross-Attention**：Decoder每个位置去attend Encoder输出的全部信息（这里没有mask，可以看到源句子全部）
5. **训练目标**：Decoder每个位置的输出，去预测**下一个词**，即用 `<BOS>` 预测 `I`，用 `<BOS> I` 预测 `love`，用 `<BOS> I love` 预测 `you`，用 `<BOS> I love you` 预测 `<EOS>`
6. 这叫 **Teacher Forcing**：训练时Decoder的输入直接用**真实的目标序列**（而不是模型自己上一步生成的词），这样可以整个序列一次性并行计算loss（用causal mask保证不泄露未来信息），不用像推理那样一步步来，训练效率很高
7. Loss就是每个位置的交叉熵损失之和

### 推理

推理时没有真实目标序列可以喂了，只能**自回归、逐词生成**：

1. Encoder对源句子"我爱你"编码一次（只需要算一次，之后复用）
2. Decoder输入 `<BOS>`，输出第一个词的概率分布，采样/取argmax得到 `I`
3. Decoder输入 `<BOS> I`，输出下一个词分布，得到 `love`
4. Decoder输入 `<BOS> I love`，得到 `you`
5. 重复，直到生成 `<EOS>`（结束符）或达到最大长度

**关键区别**：训练时Decoder的输入是真实标签（teacher forcing，一次并行算完），推理时Decoder的输入是**自己上一步生成的结果**（串行、一步步来），这个训练/推理不一致的现象叫 **exposure bias**，是自回归模型的通病。

## 二、BERT（Encoder-only）

BERT只用了Transformer的**Encoder部分**，目标不是"生成"，而是**理解/表征学习**——学一个好的双向上下文表示，之后接各种下游任务（分类、问答、NER等）。

### 结构

纯Encoder堆叠，双向self-attention（无mask，每个位置能看到整个句子的所有位置，包括左边和右边）。

### 训练（预训练阶段，两个自监督任务）

**1. MLM（Masked Language Model，掩码语言模型）**——这是核心

随机把输入句子里15%的token做处理：

- 80%概率：替换成 `[MASK]`
- 10%概率：替换成一个随机词
- 10%概率：保持不变

比如："我爱吃苹果" → "我爱吃[MASK]"

然后让模型**利用左右两边的上下文**，去预测被mask掉的原始词是什么。因为是双向attention，模型预测"苹果"时，能同时看到"我爱吃"（左边）和后面的内容（如果有），这跟GPT那种"只能看左边"完全不同。

> 为什么要80/10/10这么设计而不是全部mask？因为如果训练时全部用`[MASK]`，会导致预训练和微调（fine-tuning，下游任务输入里没有`[MASK]`）之间输入分布不一致，所以加了随机替换和保持不变，让模型不能完全依赖`[MASK]`这个标记，被迫对每个词都保持一定的上下文表征能力。

**2. NSP（Next Sentence Prediction，下一句预测）**——判断两个句子是否是连续的上下文

输入格式：`[CLS] 句子A [SEP] 句子B [SEP]`

- 50%概率，句子B确实是句子A的下一句（标签：IsNext）
- 50%概率，句子B是从语料库里随机采的句子（标签：NotNext）

用 `[CLS]` 位置最后的输出，接一个二分类器，判断是不是IsNext。

（后续研究，比如RoBERTa，发现NSP作用不大甚至有负面影响，很多改进版BERT去掉了这个任务，只保留MLM。）

### 推理（实际上更准确说是"使用/微调"）

BERT预训练完之后本身**不是用来直接生成文本的**，而是：

1. **Fine-tuning（微调）**：拿预训练好的BERT，接上一个任务相关的小输出层（比如分类头），用少量标注数据继续训练整个模型（或只训练新加的头），做下游任务，比如：
    - 文本分类：用`[CLS]`位置的输出接softmax
    - 序列标注（NER）：每个位置的输出接分类器
    - 问答（抽取式）：预测答案在原文中的起始/结束位置
2. **Feature extraction（特征提取）**：也可以直接把BERT当成一个固定的特征提取器，输出的向量表示喂给下游其他模型用，不更新BERT参数

**BERT没有"自回归生成"这个概念**，因为它是双向的，没法像GPT那样一个词一个词往后接龙生成（每次输入都要知道完整句子长度，且预测依赖"未来"信息，这跟自回归生成的因果性矛盾）。

---

## 三、GPT（Decoder-only）

GPT只用了Transformer的**Decoder部分**（去掉了Cross-Attention，因为没有Encoder了），目标是**自回归语言建模**，天然适合做生成任务。

### 结构

纯Decoder堆叠，每层 = **Masked（causal）** Self-Attention + FFN，没有cross-attention（因为没有Encoder），单向、只能看左边。

### 训练

给定海量无标注文本语料，训练目标非常简单纯粹：**预测下一个token**

具体做法：

1. 一整段文本，比如"我 爱 吃 苹果"，直接输入模型（不用像原始Transformer那样切成"输入/目标"两部分，因为Decoder-only就是"整段序列自己预测自己往后移一位"）
2. 用causal mask保证位置 $i$ 只能看到 $\le i$
3. 位置1（"我"）的输出去预测位置2（"爱"）；位置1-2的输出去预测位置3（"吃"）；以此类推
4. Loss = 所有位置的"预测下一个词"交叉熵损失之和

这跟原始Transformer的Decoder训练几乎一样（都是causal mask + teacher forcing + 预测下一个词），**唯一的区别是没有Cross-Attention（因为没有Encoder提供的额外源信息），也就是说GPT是"无条件"或者说"以自己前文为条件"的纯语言建模**，而原始Transformer的Decoder还多了一个"以Encoder编码的源句子为条件"。

> 现在instruct类GPT（ChatGPT这种）在预训练之后还有SFT（有监督微调，用问答对数据继续训练）和RLHF（用人类反馈强化学习对齐），但这些都是在"预测下一个token"这个基础训练目标上叠加的，本质训练机制不变，只是数据和loss权重变了。

### 推理

和原始Transformer的Decoder推理完全一样的逻辑——**自回归、逐token生成**：

1. 给一个起始prompt（比如"今天天气"）
2. 模型输出下一个token的概率分布，采样（top-k/top-p/温度采样）得到下一个词，比如"很"
3. 把"今天天气很"重新输入模型，预测下一个词，比如"好"
4. 重复，直到生成结束符或达到最大长度

**推理时的KV Cache优化**：每步都要把"已经生成的所有token"重新算一遍self-attention很浪费，所以实践中会把之前每一层算过的Key和Value缓存下来，新来一个token时只需要计算它和缓存的KV做attention，不用重复计算之前token的KV，这是GPT类模型推理加速的标准技巧。

## 三者关系总结表

![三者关系总结表](/assets/images/posts/transformer-comparison.png)

**一句话理解三者的核心分野**：BERT要"看全局"所以用双向attention做完形填空（理解任务的最优选择），GPT要"能生成"所以必须用单向causal attention保证因果性（生成任务的唯一选择），原始Transformer两者都要（既要理解源句子，又要生成目标句子）所以Encoder-Decoder都保留，用Cross-Attention把两者连接起来。

回到你最初问的VQGAN的Transformer——它就是纯正的**GPT架构（Decoder-only，causal self-attention）**，训练时用teacher forcing预测下一个code index，推理时自回归逐个采样，跟你现在理解的GPT训练推理逻辑是完全一致的，只是把"词表"换成了VQ codebook的index。
