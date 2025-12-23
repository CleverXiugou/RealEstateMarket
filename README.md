# 🏠 RWA Pro - 去中心化房产代币化平台

**RWA Pro (Real World Asset Protocol)** 是一个基于区块链技术的去中心化房产投资与租赁管理平台。它旨在通过智能合约将现实世界的房地产资产（RWA）上链，实现资产的**碎片化所有权（Fractional Ownership）**、**自动化租金分发**以及**去中心化租赁**。

本项目展示了 Web3 技术如何重塑传统房地产市场，消除中介，提高流动性与透明度。

---

## ✨ 核心特性

### 👨‍✈️ 房东端 (Landlord)
* **资产上链 (Mint NFT)**：将房产铸造为 NFT，永久记录链上，支持自定义户型（公寓、别墅、海景房等）及Emoji标签。
* **碎片化融资 (Fractionalization)**：设定房产估值与周期，释放 20%-100% 的股权供市场认购。
* **生命周期管理**：支持从闲置、融资、招租到出租的全流程状态流转。
* **资产销毁**：对于废弃或错误的房产信息，支持链上销毁（Burn），彻底清除数据。

### 🚀 投资者端 (Investor)
* **低门槛投资**：购买房产份额（Shares），成为早期股东。
* **被动收益**：租客支付租金后，智能合约自动计算并分发收益，无需人工干预。
* **透明看板**：实时查看持仓市值、预计回报率 (APY) 及历史收益。

### 🔑 租客端 (Tenant)
* **去中心化租赁**：直接与智能合约交互进行签约，无中介费。
* **收银台体验**：清晰的费用明细（首付 + 押金 + Gas估算）。
* **智能筛选**：支持按价格、户型、面积筛选房源，体验媲美 Web2 租房应用。

### 🔍 区块链浏览器 (RWA Explorer)
* **智能搜索**：支持输入 Token ID 查房产，或输入 0x 地址查用户。
* **数据可视化**：资产时间轴、股权结构饼图、财务报表。
* **用户 360° 画像**：聚合展示用户作为房东、投资者和租客的三重身份资产。

---

## 🛠 技术栈

* **智能合约**: Solidity (v0.8.x)
* **开发框架**: Foundry (Forge, Anvil)
* **前端框架**: React (CDN 引入，轻量级无构建工具)
* **UI 库**: Tailwind CSS (样式), SweetAlert2 (交互弹窗)
* **Web3 交互**: Ethers.js v5

---


## 🚀 快速开始

### 1. 环境准备
确保你已经安装了 [Foundry](https://book.getfoundry.sh/getting-started/installation) 和 [Git](https://git-scm.com/)。

### 2. 克隆项目

```git clone [https://github.com/YourUsername/RealEstateMarket.git]```

### 3. 启动本地链

```anvil```

### 4. 部署合约

```forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast```

### 5. 配置前端

复制部署成功后输出的 Deployed to: 0x... 地址。 打开 frontend/config.js，更新 CONTRACT_ADDRESS

```const CONTRACT_ADDRESS = "0x你的新合约地址";```

### 6. 运行前端

```python3 -m http.server 8000```

最后访问```localhost:8000```即可体验