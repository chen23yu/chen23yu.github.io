---
title: 从 VQ-VAE 到 MAR：损失函数的完整数学推导
date: 2026-07-01 15:30:00 +0800
categories:
  - 生成模型
tags:
  - vq-vae
  - vqgan
  - maskgit
  - mar
  - 数学推导
  - 损失函数
  - 扩散模型
---

# 从 VQ-VAE 到 MAR：损失函数的完整数学推导

不再打比方，直接摆数学。每一步都写清楚：变量定义、目标函数怎么来的、为什么要这样设计、以及从上一个模型到下一个模型损失函数具体发生了什么变化。

---

## 一、VQ-VAE 的数学推导

### 1.1 基本设定

输入图像 $x \in \mathbb{R}^{H\times W \times 3}$。encoder $E$ 把它映射为连续特征网格：

$$z_e = E(x) \in \mathbb{R}^{h \times w \times d}$$

codebook 是一个大小为 $K$ 的向量集合 $\mathcal{C} = \{e_1, e_2, \ldots, e_K\}$，每个 $e_k \in \mathbb{R}^d$。

对特征网格中每个空间位置 $(i,j)$ 上的向量 $z_e^{(i,j)}$，量化操作定义为：

$$z_q^{(i,j)} = e_{k^*}, \quad k^* = \arg\min_k \|z_e^{(i,j)} - e_k\|_2$$

也就是找 codebook 里离它最近的向量替换掉它。整个量化后的网格记作 $z_q = \text{Quantize}(z_e)$。

decoder $D$ 把量化后的网格还原成图像：

$$\hat{x} = D(z_q)$$

### 1.2 损失函数的推导

我们希望优化三件事：重建准确、codebook 向量学得合理、encoder 输出别乱跑。

**重建项**直接用 L2：

$$\mathcal{L}_{rec} = \|x - \hat{x}\|_2^2 = \|x - D(z_q)\|_2^2$$

**问题**：$\arg\min$ 这一步不可导，梯度传不回 $E$。VQ-VAE 用 **straight-through estimator** 解决——前向传播用 $z_q$，反向传播时把 $\hat{x}$ 对 $z_q$ 的梯度直接复制给 $z_e$，即定义：

$$z_q := z_e + \text{sg}[z_q - z_e]$$

其中 $\text{sg}[\cdot]$ 是 stop-gradient（前向传播时数值上等于 $z_q$，反向传播时梯度视为 0，即把这一项当常数）。这样一来 $\mathcal{L}_{rec}$ 对 $z_e$ 的梯度就等于对 $z_q$ 的梯度，绕过了 argmin 的不可导问题。

但光有这个 trick，codebook $\{e_k\}$ 本身还没有梯度更新的路径（因为 $\text{sg}$ 把它挡住了）。所以额外加两项：

$$\mathcal{L}_{codebook} = \|\text{sg}[z_e] - z_q\|_2^2$$

这一项只更新 codebook（$z_e$ 被截断梯度），让被选中的 codebook 向量往 $z_e$ 靠近。

$$\mathcal{L}_{commit} = \beta\|z_e - \text{sg}[z_q]\|_2^2$$

这一项只更新 encoder（$z_q$ 被截断梯度），防止 encoder 输出到处乱飘、不停切换最近邻。

总损失：

$$\mathcal{L}_{VQVAE} = \mathcal{L}_{rec} + \mathcal{L}_{codebook} + \beta\,\mathcal{L}_{commit}$$

### 1.3 采样：PixelCNN

量化后网格是离散的整数索引序列 $s = (s_1, \ldots, s_N)$，$N=h\times w$，$s_i \in \{1,\ldots,K\}$。PixelCNN 建模自回归分布：

$$p(s) = \prod_{i=1}^{N} p(s_i \mid s_1, \ldots, s_{i-1})$$

训练目标是最大似然，等价于最小化交叉熵：

$$\mathcal{L}_{PixelCNN} = -\sum_{i=1}^N \log p_\theta(s_i \mid s_{<i})$$

这里 $s_{<i}$ 只能是"左上方"的像素，因为 PixelCNN 用的是带掩码的卷积核（masked convolution），感受野被限制成因果结构。这正是它信息利用不充分、生成质量有限的数学根源。

---

## 二、VQGAN 的数学推导：在 VQ-VAE 基础上改两处

### 2.1 重建损失升级：加入感知损失和对抗损失

VQGAN 保留 VQ-VAE 的 $\mathcal{L}_{codebook}$、$\mathcal{L}_{commit}$（有的实现改用指数滑动平均更新 codebook，但数学本质不变），只把重建项换掉：

$$\mathcal{L}_{rec}^{VQGAN} = \|x - \hat x\|_1 + \mathcal{L}_{LPIPS}(x,\hat x)$$

$\mathcal{L}_{LPIPS}$ 定义为在预训练网络 $\phi$（通常是 VGG）多层特征上的距离：

$$\mathcal{L}_{LPIPS}(x,\hat x) = \sum_l w_l \|\phi_l(x) - \phi_l(\hat x)\|_2^2$$

再引入判别器 $D_\psi$，构成标准 GAN 极小极大目标：

$$\mathcal{L}_{GAN} = \log D_\psi(x) + \log(1-D_\psi(\hat x))$$

判别器最大化 $\mathcal{L}_{GAN}$（学会分辨真假），生成器（$E,D$）最小化 $\mathcal{L}_{GAN}$ 的第二项（让 $D_\psi(\hat x)$ 尽量接近判为真）。两者自适应加权组合（论文用了一个基于梯度范数自适应平衡两个损失的系数 $\lambda$）：

$$\mathcal{L}_{VQGAN} = \mathcal{L}_{rec}^{VQGAN} + \mathcal{L}_{codebook} + \beta\mathcal{L}_{commit} + \lambda\,\mathcal{L}_{GAN}$$

**为什么这样改能解决模糊问题**：L2/L1 单独优化时，对于一个多峰的真实分布（同一小块纹理可能对应无数种同样合理的高频细节），最优解是所有峰的均值，这是模糊的根源。LPIPS 把误差算在深层特征空间而不是像素空间，容忍像素级的小偏移；GAN 损失则完全不看"逐点误差"，只要求"整体分布看起来真实"，两者共同作用避免了均值塌缩。

### 2.2 采样阶段升级：Transformer 替换 PixelCNN

自回归形式不变，只是把 $p_\theta(s_i\|s_{<i})$ 的建模网络从带掩码卷积换成因果自注意力 Transformer：

$$\mathcal{L}_{transformer} = -\sum_{i=1}^N \log p_\theta(s_i \mid s_{<i})$$

数学形式和 PixelCNN 完全一样，区别只在于 $p_\theta$ 内部结构——self-attention 让 $s_i$ 的预测可以直接 attend 到所有 $s_{<i}$（不受局部卷积核感受野限制），长程依赖建模能力更强。这一步**没有改损失函数的形式，只改了参数化 $p_\theta$ 的网络结构**。

---

## 三、MaskGIT 的数学推导：从自回归到掩码双向建模

Tokenizer 部分（$E, D$, codebook, GAN 损失）**原样复用 VQGAN**，不再重复推导。变化全部发生在第二阶段。

### 3.1 训练目标的推导

不再假设一个固定顺序（$s_1 \to s_2 \to \cdots \to s_N$），而是随机选一个位置子集 $M \subseteq \{1,\ldots,N\}$ 作为"被遮住"的集合，遮住比例 $r=\|M\|/N$ 由一个调度函数采样（论文用余弦函数 $\gamma(r)=\cos(\frac{\pi}{2}r)$ 决定每一步该遮多少）。

把 $M$ 中位置替换成特殊符号 `[MASK]`，得到破损序列 $Y_M$。训练目标是最大似然填补：

$$p(Y_M \mid Y_{\bar M}) = \prod_{i \in M} p(y_i \mid Y_{\bar M})$$

注意这里的关键假设：**给定可见集合 $Y_{\bar M}$，各个被遮位置的预测被建模为条件独立**（这是与自回归的本质区别——自回归里 $p(s_i\|s_{<i})$ 的条件集合会随 $i$ 递增，各项之间存在链式依赖；这里所有 $y_i, i\in M$ 的条件集合都是同一个固定的 $Y_{\bar M}$，彼此独立并行预测）。

对应损失（负对数似然）：

$$\mathcal{L}_{mask} = -\mathbb{E}_{Y,\,M\sim\gamma}\left[\sum_{i\in M}\log p_\theta(y_i \mid Y_{\bar M})\right]$$

这跟 BERT 的 MLM 损失

$$\mathcal{L}_{BERT} = -\mathbb{E}_{X,M}\left[\sum_{i\in M}\log p_\theta(x_i\mid X_{\bar M})\right]$$

在数学形式上**完全同构**，只是 $X$（文字 token 序列）换成了 $Y$（VQGAN 离散图像 token 序列）。这就是"把 BERT 完形填空搬到图像"这句话背后严格的等价关系。

### 3.2 推理阶段的数学描述（不是损失，是采样算法）

设总共迭代 $T$ 轮（比如论文取 $T=8$）。第 $t$ 轮（$t=1,\ldots,T$）：

**第一步**，把当前已确定集合 $\bar M_{t-1}$ 之外的所有位置喂入模型，得到每个未确定位置 $i$ 的分布 $p_\theta(y_i \mid Y_{\bar M_{t-1}})$，取

$$\hat y_i = \arg\max_{y} p_\theta(y\mid Y_{\bar M_{t-1}}), \quad c_i = \max_y p_\theta(y\mid Y_{\bar M_{t-1}})$$

$c_i$ 就是这个位置的置信度分数。

**第二步**，按照调度函数决定这一轮应该保留多少个位置：

$$n_t = \lceil \gamma(t/T)\cdot N \rceil$$

**第三步**，把 $c_i$ 从高到低排序，取 top-$(N-n_t)$ 的那些位置的 $\hat y_i$ 确定下来，纳入 $\bar M_t$；剩下 $n_t$ 个位置重新设为 `[MASK]`，进入下一轮。

（有的实现在取 top-k 之前对 $c_i$ 加了一点 Gumbel 噪声做温度采样，增加多样性，但这是工程细节，不影响主干逻辑。）

**这个采样算法完全依赖"$c_i$ 是一个标量置信度"这一前提**——它来自 softmax 分布的最大值，是离散分类问题的天然产物。这一点是理解为什么 MAR 需要重新设计的关键伏笔。

---

## 四、MAR 的数学推导：从离散分类到连续扩散

### 4.1 Tokenizer 变化：不再量化

MAR 使用一个普通连续 VAE（无 codebook），encoder 直接输出连续向量网格：

$$x = E(\text{image}) \in \mathbb{R}^{N\times d}, \quad x=(x_1,\ldots,x_N),\ x_i \in \mathbb{R}^d$$

没有 $\arg\min$ 量化步骤，因此也不再需要 $\mathcal{L}_{codebook}$、$\mathcal{L}_{commit}$、straight-through estimator ——这些都是量化操作带来的副产物，量化没了它们自然消失。

### 4.2 为什么不能直接用 softmax：数学上的具体障碍

假设我们天真地照搬 MaskGIT 框架，只是把预测目标换成连续向量 $x_i \in \mathbb{R}^d$，直接用网络回归：

$$\mathcal{L}_{naive} = \sum_{i\in M} \|x_i - f_\theta(z_i)\|_2^2$$

这里 $z_i$ 是 Transformer 对位置 $i$ 输出的 hidden state。

这个损失在数学上对应于假设 $p(x_i\|z_i)$ 是**单峰高斯分布**，$f_\theta(z_i)$ 学的是这个高斯分布的均值。当真实条件分布 $p(x_i\|z_i)$ 本身是多峰的（同一上下文允许多种合理结果），L2 回归给出的最优解恰恰是：

$$f_\theta^*(z_i) = \mathbb{E}[x_i \mid z_i]$$

即所有峰值的加权平均——这正是"模糊平均"问题的数学根源，和 VQ-VAE 重建模糊是同一个数学机制。

### 4.3 用扩散模型建模条件分布 $p(x_i\|z_i)$

要表达多峰分布，MAR 换一种参数化方式：不直接学一个确定性映射 $f_\theta$，而是学习一个**以 $z_i$ 为条件的扩散模型**，去建模完整的条件分布 $p_\theta(x_i\|z_i)$，而不只是它的均值。

标准 DDPM 前向加噪过程：

$$x_i^t = \sqrt{\bar\alpha_t}\,x_i + \sqrt{1-\bar\alpha_t}\,\epsilon,\quad \epsilon\sim\mathcal{N}(0,I)$$

$t$ 是扩散时间步，$\bar\alpha_t$ 是噪声调度参数。训练一个小网络 $\epsilon_\phi$（就是 diffusion head，接收 $x_i^t$、时间步 $t$、以及条件 $z_i$）去预测噪声：

$$\mathcal{L}_{diff}(z_i, x_i) = \mathbb{E}_{t,\epsilon}\left[\|\epsilon - \epsilon_\phi(x_i^t, t \mid z_i)\|_2^2\right]$$

MAR 的整体训练损失，对所有被 mask 的位置求和：

$$\mathcal{L}_{MAR} = \mathbb{E}_{x,M}\left[\sum_{i\in M} \mathcal{L}_{diff}(z_i, x_i)\right], \quad z_i = \text{Transformer}_\theta(x_{\bar M})_i$$

注意这里 $z_i$ 是主干 Transformer 的输出（对整个可见序列 $x_{\bar M}$ 做双向自注意力后，取第 $i$ 个位置的 hidden state），而 $\epsilon_\phi$（diffusion head）和 $\text{Transformer}_\theta$（主干）是**两个分开的网络，联合训练**——主干 Transformer 的梯度来自 $\mathcal{L}_{diff}$ 通过 $z_i$ 反传回去，diffusion head 的梯度直接来自 $\mathcal{L}_{diff}$ 本身。

**为什么这样就能表达多峰分布**：扩散模型的理论保证是，只要 $\epsilon_\phi$ 训练得足够好，从纯噪声出发通过反向扩散采样得到的 $x_i$，其分布就逼近真实的 $p(x_i\|z_i)$——不管这个分布是单峰还是多峰、是高斯还是任意复杂形状，扩散过程理论上都能建模（这是扩散模型相对于直接回归的根本优势，数学基础来自 score matching / 朗之万动力学）。

### 4.4 推理阶段的采样公式

对某个被选定要在这一轮确定的位置 $i$，用标准 DDPM 反向采样公式，从 $x_i^T \sim \mathcal{N}(0,I)$ 开始，逐步去噪：

$$x_i^{t-1} = \frac{1}{\sqrt{\alpha_t}}\left(x_i^t - \frac{1-\alpha_t}{\sqrt{1-\bar\alpha_t}}\epsilon_\phi(x_i^t,t\mid z_i)\right) + \sigma_t z,\quad z\sim\mathcal{N}(0,I)$$

迭代 $t=T,\ldots,1$，最终 $x_i^0$ 就是这个位置采样出来的具体连续向量。

### 4.5 解锁顺序的变化：为什么放弃置信度

MaskGIT 的置信度 $c_i=\max_y p_\theta(y\|Y_{\bar M})$ 依赖离散分布存在一个"最大概率值"。在 MAR 里，$p_\theta(x_i\|z_i)$ 是一个连续密度，理论上也存在"密度值"这种东西，但从扩散模型中直接算出精确的似然值代价很高（需要额外的 ODE 积分），实践中不划算。所以 MAR 干脆放弃"挑最有把握"这一策略，改用**固定或随机的位置调度**——每轮按照一个预先设定好数量的调度 $n_t$（跟 MaskGIT 一样有一个余弦式调度），随机（而不是按置信度）挑选 $n_t$ 个位置去跑扩散采样。数学上这一步只是一个采样策略的选择，不涉及额外的损失项。

---

## 五、四者损失函数的总览对照表

| 模型 | 目标空间 | 训练目标 | 核心公式 | 解决的问题 |
|---|---|---|---|---|
| VQ-VAE | 像素 | 重建+codebook学习 | $\|x-D(z_q)\|^2 + \|\text{sg}[z_e]-z_q\|^2+\beta\|z_e-\text{sg}[z_q]\|^2$ | 把图像压成离散序列 |
| VQGAN | 像素 | 重建（感知+GAN）+codebook学习 | 上式重建项换成 $\|x-\hat x\|_1+\mathcal L_{LPIPS}+\lambda\mathcal L_{GAN}$ | L2导致的模糊 |
| VQGAN-Transformer | 离散token | 自回归似然 | $-\sum_i\log p_\theta(s_i\mid s_{<i})$ | 建模token联合分布 |
| MaskGIT | 离散token | 掩码似然 | $-\sum_{i\in M}\log p_\theta(y_i\mid Y_{\bar M})$ | 自回归慢、单向 |
| MAR | 连续向量 | 逐位置扩散损失 | $\sum_{i\in M}\mathbb E_{t,\epsilon}\|\epsilon-\epsilon_\phi(x_i^t,t\mid z_i)\|^2$ | 离散化损失信息+L2回归的模糊/塌缩 |

从左到右整条链路，可以看成两条独立的数学改进主线交替发生：**"重建质量"这条线**（L2 → 感知+GAN，发生在 VQ-VAE→VQGAN）；**"预测目标分布"这条线**（自回归 → 双向掩码 → 掩码+连续扩散，发生在 VQGAN→MaskGIT→MAR）。Bernini 的 $\mathcal{L}_{visual}$ 完全继承了 MAR 这一项的数学形式（只是把 DDPM 换成流匹配、把 Transformer 换成 MLLM），你现在应该能逐行对照着把 Bernini 论文里那个损失公式的每个符号意义都对应回去了。
