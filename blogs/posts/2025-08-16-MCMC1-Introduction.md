蒙特卡洛方法(Monte Carlo methods)是一种利用随机实验近似确定性问题（例如计数，积分，优化问题等）的方法，而通常情况下这些问题的确定性算法有着糟糕的运行时间或者精度误差。

1930 年代，Fermi 在一项非发表的研究中，首次使用蒙特卡洛方法来研究中子扩散问题 [^1]。1946 年，物理学家 Stanislaw Ulam 在洛斯阿拉莫斯国家实验室研究核武器的项目中，提出了现代版本的马尔可夫链蒙特卡洛方法(Markov Chain Monte Carlo, MCMC)，以代替传统的确定性数值算法。并且 Ulam 与同事 von Neumann，Metropolis 提议将这一绝密计划的代号命名为 Monte Carlo，这来源于他那经常借钱赌博的叔叔常去的赌城。

蒙特卡洛方法的通常范式是：首先设计一个随机变量 $Z$，使得 $Z$ 的期望 $\mathbb{E}(Z)$ 恰好等于问题的答案；然后不断从 $Z$ 的概率分布 $\mu$ 上均匀采样($\forall i,Z_i\sim\mu$)；之后将采样得到的 $Z_i$ 平均起来得到 $\overline{Z}$，根据大数定理 $\overline{Z}$ 收敛至 $\mathbb{E}(Z)$，即问题的答案。

一个经典的蒙特卡洛方法的例子是，通过在 $[0,1]^2$ 的区域上随机采样，近似计算圆周率。

![](blogs/assets/images/Pi_monte_carlo_all.gif "使用蒙特卡洛法仿真计算 Pi")

设 $\omega$ 是 $[0,1]^2$ 上的均匀采样，如果 $\omega$ 落在上图 1/4 圆之内，则 $Z=1$，否则 $Z=0$，很容易知道 $\mathbb{E}(Z)=\frac{\pi}{4}$。在这个例子下，蒙特卡洛方法的收敛速率也是很容易计算的，假设算法运行了 $n$ 轮，由于每次采样的 $Z_i$ 是独立同分布，根据 Hoeffding's inequality

$$\Pr(|\overline{Z}-\mathbb{E}(Z)|\ge\epsilon)\le  2e^{-2n\epsilon^2}\le\delta\\$$

所以 $n=O(1/\epsilon^2\log(1/\delta))$。虽然在这个例子中，蒙特卡洛方法相较于一些确定性算法收敛的更慢，但是在许多其他确定性算法很难设计得高效的复杂情形中，蒙特卡洛方法则有许多优势。

## 计数问题 Counting Problem

计数问题是组合数学中最古老也是最基本的一类问题，主要研究满足特定约束的组合对象的数量。但是许多计数问题在计算上都是困难的，例如图的合法染色计数，二分图的完美匹配计数。为了描述这种困难性，Valiant 定义了一种计数问题的复杂度。

**Definition 1.1(Valiant, 1977[^2])** 定义计数图灵机(Counting Turing Machine)为能统计并输出所有接受分支数量的非确定性图灵机。所有计数问题 $f:\Sigma^*\rightarrow \mathbb{N}$ 中所有能被计数图灵机在多项式时间内出的计数函数的集合被称为 $\mathrm{\#P}$。

大部分 $\mathrm{NP}$ 中的判定问题都有很自然的计数版本在 $\mathrm{\# P}$ 中，例如 $\mathrm{SAT}$ 问题对应的计数问题 $\mathrm{\#SAT}$ 表示：求解布尔表达式 $\phi$ 的可满足解的个数。可以观察到，由于这种对应关系总是存在，所以 $\mathrm{\# P}$ 比 $\mathrm{NP}$ 更为困难，因为得到可行解的数量可以直接推出可行解的存在性，即 $\mathrm{NP}\subseteq\mathrm{P}^\mathrm{\# P}$。1991 年 Toda 进一步证明了 $\mathrm{PH}\subseteq\mathrm{P}^\mathrm{\# P}$，这表明了很多计数问题在多项式层谱以内都很难解决。

仿照 $\mathrm{NP}$ 完全问题，我们也可以定义 $\mathrm{\# P}$ 完全问题：如果所有的 $f\in\mathrm{\# P}$，都可以在多项式时间内规约到函数 $F$，则 $F\in\text{\#P-hard}$；如果同时 $F\in\mathrm{\#P}$，则 $F\in\text{\#P-complete}$。根据 Cook–Levin theorem，可以很容易地知道 $\mathrm{\#SAT}$ 是 $\mathrm{\# P}$ 完全问题。但是非 $\mathrm{NP}$ 完全问题对应的计数问题也有可能是 $\mathrm{\# P}$ 完全的，例如 $\text{\#2-SAT}$ 或者 $\text{\#MATCH}$ 问题。

但是近似的解决 $\mathrm{\# P}$ 完全问题是有可能。Sipser 与 Stockmeyer 于 1983 年各自独立地证明了这一点。

**Theorem 1.1(Sipser & Stockmeyer, 1983[^4]).** 对于任意 $f\in\mathrm{\#P}$, 存在一个有着 NP 预言机的随机算法 $M$，能够在 $\mathrm{Poly}(|x|,1/\epsilon)$ 时间内输出 $M(x,\epsilon)$ 使得

$$\Pr((1+\epsilon)^{-1}f(x)\le M(x,1/\epsilon)\le(1+\epsilon)f(x))\ge \frac{3}{4}\\$$

即 $\text{approximations of \#P}\subseteq\text{RP}^\text{NP}\subseteq\Sigma^P_2\subseteq\mathrm{PH}$。

Theorem 1.1 说明了近似计算计数问题似乎比精确计算容易很多（近似计算在 $\mathrm{PH}$ 内，而精确计数在 $\mathrm{PH}$ 外），而一种比较常见的途径是利用均匀采样来完成，这里以 $\text{\#SAT}$ 问题为例来说明这一点。

**Theorem 1.2** 假设存在一个采样示谕机 $S$，输入一个布尔表达式 $\phi$，能够输出其满足解的一个均匀采样 $\hat{x}$。则存在一个确定性算法 $M$ 能在 $\mathrm{Poly}(|\phi|,1/\epsilon)$ 的时间内，输出任意布尔表达式 $\phi$ 可满足的数量的一个近似 $M(\phi,\epsilon)$，使得

$$\Pr((1+\epsilon)^{-1}\mathrm{\#SAT}(\phi)\le M(\phi,1/\epsilon)\le(1+\epsilon)\mathrm{\#SAT}(\phi))\ge \frac{3}{4}\\$$

**Proof** 设 $\tilde{x}$ 是 $\phi$ 的一组满足解，定义 $\phi_{0},\phi_1,\cdots,\phi_n$，其中 $\phi_i\triangleq \phi(\tilde x|_{[i]})$ 表示 $\phi$ 在固定前 $i$ 个变量等于 $\tilde x$ 时得到的新的布尔布尔表达式。容易知道对于任意 $x$，$\phi(x)=1$ 可以推出对于任意 $i$，$\phi_i(x)=1$。设 $\Omega$ 为 $\phi$ 的可行解集合，$\Omega_i$ 为 $\phi_i$ 的可行解集合。

$$|\Omega|=\frac{|\Omega_0|}{|\Omega_1|}\times \frac{|\Omega_1|}{|\Omega_2|}\times\cdots\times \frac{|\Omega_{n-1}|}{|\Omega_n|}\\$$

令 $Z_i=\frac{|\Omega_{i-1}|}{|\Omega_i|}$，则有 $|\Omega|=\prod\limits_{i=1}^nZ_i$，所以考虑通过采样示谕机一步一步的选取合适 $x_i$ 并且使用门特卡洛方法估算 $Z_i$ 将问题规模缩小，则 $M^S(\psi,\epsilon)$ 可以设计为：

 - 运行 $T=O(n\log n/\epsilon^2)$ 轮 $S(\phi)$ 得到一组随机的可满足解 $\{x^{(j)}\}$，设 $x_i=0$ 的可满足解有 $a$ 组，$x_i=1$ 的可满足解有 $b$ 组，记 $U=\max\{a,b\}$，$\hat{Z}_i=\frac{T}{U}$。
 - 令 $\tilde x_i$ 为采样到的可满足解更多的 $x_i$ 取值。递归运行 $\hat{Z}'=M^S(\phi|_{x_i=\tilde x_i},\epsilon)$。
 - 返回 $\hat{Z}=\hat{Z}_i\times\hat{Z}'$。

假设算法得到的最终变量取值为 $\tilde x$，对于任意 $i$ 定义坏事件 $A_i$ 表示 $\frac{|\Omega_{i-1}|}{|\Omega_i|}\ge 16$，则 $\Pr(A_i)\le\frac{2^n}{8^{n/2}}=1/2^n$ 所以

$$\Pr(A)\triangleq\Pr\left(\bigcup_{i=1}^n A_i\right)\le n\Pr(A_i)=\frac{n}{2^n}\le\frac{1}{8}\\$$

当 $n\ge 6$ 时成立。

除此之外当所有 $A_i$ 均不成立时，对于任意 $i$，$Z_i=\frac{|\Omega_{i-1}|}{|\Omega_i|}<16$，所以 $\frac{1}{16}\le \frac{1}{Z_i}\le 1$。设指示随机变量 $I_j$ 表示 $S(\phi_i)$ 第 $j$ 轮采样的可行解 $x^{(j)}$ 满足 $x^{(j)}_i=\tilde{x}_i$，则有 $\mathbb{E}(I_j)=\frac{1}{Z_i}$，$\frac{1}{\hat{Z_i}}=\frac{U}{T}=\frac{1}{T}\sum\limits_{j=1}^T I_i$ 是 $\frac{1}{Z_i}$ 的一个很好的估计，根据前文对于蒙特卡洛方法计算 $\pi$ 的收敛速度分析，可以知道，存在 $T=O(n\log n/\epsilon^2)$。

$$\Pr\left(\left(1+\frac{\epsilon}{2n}\right)^{-1}\cdot\frac{1}{Z_i}\le\frac{1}{\hat{Z_i}}\left(1+\frac{\epsilon}{2n}\right)\cdot\frac{1}{Z_i}\right)\ge 1-\frac{1}{16n}\\$$

转换后可得到

$$\Pr\left(\left(1+\frac{\epsilon}{2n}\right)^{-1}\cdot Z_i\le\hat{Z_i}\le\left(1+\frac{\epsilon}{2n}\right)\cdot Z_i\right)\ge 1-\frac{1}{16n}\\$$

累乘起来可得

$$\Pr\left(\left(1+\frac{\epsilon}{2n}\right)^{-n}|\Omega|\le\hat{Z}\le \left(1+\frac{\epsilon}{2n}\right)^n|\Omega|\right)\ge \left(1-\frac{1}{16n}\right)^n\\$$

由于在 $[-1,0]$ 内，有 $1+\frac{x}{2}\ge e^x$，所以 $(1-\frac{1}{16n})^n\ge e^{-\frac{1}{8n}\times n}\ge 1-\frac{1}{8}$；同样地，在 $[0,1]$ 内有 $e^\frac{x}{2}\le 1+x$，当 $\frac{\epsilon}{2n}\le 1$ 时，$(1+\frac{\epsilon}{2n})^n\le e^{\frac{\epsilon}{2n}\times n}\le 1+\epsilon$。所以综合起来可得

$$\Pr\left(\left(1+\epsilon\right)^{-1}|\Omega|\le\hat{Z}\le (1+\epsilon)|\Omega|\right)\ge \frac{7}{8}\\$$

定义坏事件 $B$ 表示算法估计失败。

$$\Pr(\overline{A}\cap\overline{B})\ge 1-\Pr(A)-\Pr(B|A)\ge 1-\frac{1}{8}-\frac{1}{8}=\frac{3}{4}\\$$

于是我们便得到了一个在 $O(n^2\log n/\epsilon^2)$ 步采样近似计算 $\mathrm{\#SAT}$ 问题的算法。但是这样的采样示谕机 $S$ 是否能够很容易的得到呢？

## 自旋系统 Spin System

在统计物理学中，学者们经常考虑一种简化的模型——自旋系统(Spin System)。一个自旋系统由一个无向图 $G(V,E)$ 和一个状态集合 $Q$ 所组成，对于自旋系统中的每一个组态(configuration) $\sigma\in Q^{|V|}$，其哈密尔顿量(或能量)表示为

$$H(\sigma)=\sum_{(u,v)\in E} f(\sigma_u,\sigma_v)+\sum_{u\in V} g(\sigma_v)\\$$

以描述磁现象的伊辛模型(Ising Model)为例，$Q$ 只有两个状态 $+1$ 或 $-1$，表示原子的磁矩(自旋)。而 $f(\cdot,\cdot)=J_{u,v}\sigma_u\sigma_v$ 表示晶格点之间的交互作用，$g(\cdot)=h_u\sigma_u$ 表示外加磁场的作用。

![](blogs/assets/images/Ising_quench_b10.gif "β=10 时伊辛模型的仿真")

自旋系统在热平衡的情况下，其组态呈现玻尔兹曼分布(Boltzmann distribution，也称为吉布斯分布 Gibbs distribution)

$$\mu(\sigma)\propto e^{-\beta H(\sigma)}\\$$

其中 $\beta=\frac{1}{KT}$ 是只与温度相关的参数。而该分布的比例因子

$$Z(\beta)=\sum_{\sigma}e^{-\beta H(\sigma)}\\$$

被称为配分函数(partition function)。配分函数与许多物理现象息息相关，例如系统整体的内能，磁化率等等。然而配分函数的计算是困难的，那如何在配分函数无法计算的情况下对 $\mu$ 进行采样以近似计算自旋系统的各种参数以及相变呢？

## 马尔可夫链蒙特卡洛 Markov Chain Monte Carlo

为了解决上述概率分布很奇怪或者很难求出来的情况下的采样问题，马尔可夫链蒙特卡洛方法被发明了出来。简单来说 MCMC 的主要思路是：对于一个需要采样的分布 $\mu$，构造一个马尔可夫链 $P$，使得 $\mu$ 是 $P$ 唯一的平稳分布(Stationary Distribution),然后从某个任意地初始状态出发，在马尔可夫链 $P$ 上随机游走，在有限步以内停止，作为采样返回。在马尔可夫链不太病态的情况下，所游走到的状态的概率分布将无限趋近于稳态分步。

**Definition 1.2** 对于两个 $\Omega$ 上的分布 $\nu,\mu$，可以使用全变差距离(total variation distance)来描述两者之间的差距：

$$D_\mathrm{TV}(\nu\parallel\mu)\triangleq=\frac{1}{2}\sum_{w\in\Omega}|\nu(w)-\mu(w)|=\frac{1}{2}\lVert\nu-\mu\rVert_1=\max_{A\in 2^\Omega}|\nu(A)-\mu(A)|\\$$

（马尔可夫链基本定理，将在下一节中严谨的定义与证明）对于任意非病态的马尔可夫链 $P$，如果其稳态分布为 $\mu$，从初始分布 $\nu$ 开始出发，则有

$$\lim_{n\rightarrow \infty} D_\mathrm{TV}(\nu P^n\parallel\mu P^n)=0\\$$

可以看出来 MCMC 方法得到的是一个近似采样，并且可以n任意地接近真实分布(good sampling)，但是在许多情况下近似采样就足以代替精确采样了。

**Theorem 1.3** 设 $\nu$ 是 $\mu$ 的近似分布，$Z_1,Z_2,\cdots,Z_t$ 是 $\nu$ 上的一组采样，$\hat{Z}=\frac{1}{t}\sum\limits_{i=1}^t Z_i$。如果 $D_\mathrm{TV}(\nu\parallel\mu)\le\delta=\epsilon\mu_{\min}/3$，其中 $\mu_{\min}=\min\limits_{x\in\Omega}\mu(x)$，$Z$ 是 $\mu$ 上的随机变量，值域大小为 $n$，$\mathbb{E}=m$。当 $t=O(n/\epsilon^2 m)$ 时

$$\Pr(|\hat{Z}-\mathbb{E}Z|\ge\epsilon \mathbb{E}Z)\le\frac{1}{4}\\$$

**Proof** 根据分数不等式 $\min\limits_{x\in\Omega}\frac{\nu(x)}{\mu(x)}\le\frac{\mathbb{E}\hat{Z}}{\mathbb{E}Z}\le\max\limits_{x\in\Omega}\frac{\nu(x)}{\mu(x)}$，$1-\frac{\delta}{\mu_{\min}}\le\frac{\mathbb{E}\hat{Z}}{\mathbb{E}Z}\le 1+\frac{\delta}{\mu_{\min}}$，所以有

$$|\mathbb{E}\hat{Z}-\mathbb{E}Z|\le\frac{\epsilon}{3}\mathbb{E} Z\\$$

根据 Hoeffding's inequality，存在 $t=O(n/\epsilon^2m)$ 使得

$$\Pr(|\hat{Z}-\mathbb{E}\hat{Z}|\ge\frac{\epsilon}{3}\mathbb{E}Z)\le  \frac{1}{4}\\$$

两者综合即可得。$\square$

于是随之而来的问题是，对于一个马尔可夫链，需要在上面游走多少轮才能达到无视误差的地步，这也是本系列之后所主要探讨的问题，马尔可夫链的混合时间(mixing time)。

**Definition(混合时间)** 对于马尔可夫链 $P$，其混合时间 $\tau$ 定义为

$$\tau(\epsilon)\triangleq\max_{\nu}\min\left\{t:D_\mathrm{TV}(\nu P^t\parallel\mu P^t)\le\epsilon\right\}\\$$

马尔可夫链的混合时间直接决定了 MCMC 算法的运行效率，自 MCMC 方法发明以来，有许多关于混合时间分析的优秀方法被提出，例如偶合法(Coupling Method)。至今马尔可夫链混合时间的研究依然是热门方向。

## Reference

 - Alistair Sinclair, Partition Functions(UC Berkeley CS294-180) Lecture Note 1. Counting Problem https://people.eecs.berkeley.edu/~sinclair/cs294/n1.pdf
 - Alistair Sinclair, Partition Functions(UC Berkeley CS294-180) Lecture Note 4. Approximate Counting https://people.eecs.berkeley.edu/~sinclair/cs294/n4.pdf

[^1]: Metropolis 在 Los Alamos Science 发表的回顾蒙特卡洛方法发展史的短文 The beginning of the Monte Carlo method 中首次公开提到了这一历史 https://sgp.fas.org/othergov/doe/lanl/pubs/00326866.pdf

[^2]: L.G. Valiant. The complexity of computing the permanent. Theoretical Computer Science, 8:189–201, 1979. https://core.ac.uk/download/pdf/82500417.pdf

[^3]: Seinosuke Toda, PP is as Hard as the Polynomial-Time Hierarchy, SIAM Journal on Computing. 20 (5): 865–877. https://epubs.siam.org/doi/10.1137/0220053

[^4]: L.G. Valiant 与 V.V. Vazirani. 基于 random bisection technique 的证明 https://doi.org/10.1016/0304-3975(86)90135-0