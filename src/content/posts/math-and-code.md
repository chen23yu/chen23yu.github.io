---
title: '示例｜让公式、代码与思路对齐'
published: 2026-10-17
description: '检查论文解读中的公式、代码块、脚注和表格排版，作为后续写作的参考。'
tags: ['公式推导', '代码笔记']
category: '推导笔记'
draft: false
---

> 本文是排版示例，可以删除。下面用加权求和展示公式和代码的写法，不对应某篇论文的研究结论。

## 先说明符号

设向量 $x=(x_1,x_2,\ldots,x_n)$ 的加权和为 $y$。其中 $w_i$ 表示第 $i$ 个分量的权重：

$$
y=\sum_{i=1}^{n}w_i x_i.
$$

例如，取 $x=(1,2,3)$、$w=(0.2,0.3,0.5)$，则 $y=0.2+0.6+1.5=2.3$。

## 把步骤对应到代码

```python title="weighted_sum.py"
def weighted_sum(values, weights):
    if len(values) != len(weights):
        raise ValueError("values and weights must have equal lengths")
    return sum(x * w for x, w in zip(values, weights))

print(weighted_sum([1, 2, 3], [0.2, 0.3, 0.5]))  # 2.3
```

`x * w` 计算每项贡献，`sum` 把这些贡献加起来。写解读时，可以把关键代码与数学表达逐步对应。

## 标出条件与边界

| 条件 | 说明 |
| --- | --- |
| 长度一致 | 每个数值对应一个权重 |
| 权重和为 1 | 这是加权平均常用的条件；一般的加权和不要求 |
| 非负权重 | 若同时满足权重和为 1，结果位于输入的最小值和最大值之间 |

## 补充资料

引用原文时可以使用链接，额外说明可以使用脚注。[^note]

[^note]: 这里是脚注示例，可以用于补充符号约定或引用出处。
