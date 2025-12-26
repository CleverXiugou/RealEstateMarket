const { useState } = React;

const InvestmentMarket = ({ account, properties, onBuy, loadingMap }) => {
    // 1. 只筛选处于 "融资中" (status === 1) 的项目
    const activeList = properties.filter(p => p.status === 1);

    // 2. 计算一些市场统计数据
    const totalProjects = activeList.length;
    
    const totalSharesAvailable = activeList.reduce((acc, p) => {
        // 安全转换 BigNumber
        const sold = p.totalSharesSold && p.totalSharesSold.toNumber ? p.totalSharesSold.toNumber() : Number(p.totalSharesSold);
        return acc + (100 - sold);
    }, 0);

    const totalMarketValue = activeList.reduce((acc, p) => {
        const price = parseFloat(ethers.utils.formatEther(p.sharePrice));
        return acc + (price * 100);
    }, 0);

    // 🌟 辅助组件：信誉星星 (优化样式)
    const ReputationStars = ({ score }) => {
        const stars = Math.min(Math.max(score || 0, 0), 5);
        return (
            <div className="flex items-center bg-black/20 backdrop-blur px-2 py-1 rounded-full gap-0.5" title={`信誉积分: ${score}`}>
                {[...Array(5)].map((_, i) => (
                    <span key={i} className={`text-[10px] ${i < stars ? "text-yellow-400" : "text-white/30"}`}>★</span>
                ))}
            </div>
        );
    };

    // 购买处理
    const handleBuyClick = async (p, sold, endTime) => {
        // 计算剩余天数
        const daysLeft = Math.max(0, Math.round((endTime - Date.now()/1000)/86400));
        const remainingShares = 100 - sold;

        const { value: amount } = await Swal.fire({
            title: `💎 投资 - ${p.name}`,
            html: `
                <div class="text-left text-sm bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4 space-y-3">
                    <div class="flex justify-between border-b border-gray-200 pb-2">
                        <span class="text-gray-500">当前单价</span>
                        <span class="font-bold text-indigo-600 font-mono">${ethers.utils.formatEther(p.sharePrice)} ETH</span>
                    </div>
                    <div class="flex justify-between border-b border-gray-200 pb-2">
                        <span class="text-gray-500">剩余份额</span>
                        <span class="font-bold text-gray-800">${remainingShares} 份</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">融资倒计时</span>
                        <span class="font-bold text-orange-500">${daysLeft} 天</span>
                    </div>
                </div>
                <div class="mb-1 text-left"><label class="text-sm font-bold text-gray-700">购买份数</label></div>
                <input id="buy-amount" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="请输入数量 (最大 ${remainingShares})" type="number" min="1" max="${remainingShares}">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '下一步: 支付',
            confirmButtonColor: '#4f46e5',
            customClass: {
                popup: 'rounded-2xl',
                confirmButton: 'rounded-xl px-6',
                cancelButton: 'rounded-xl px-6'
            },
            preConfirm: () => {
                const val = document.getElementById('buy-amount').value;
                if (!val || val < 1) Swal.showValidationMessage('请输入有效的份数');
                if (val > remainingShares) Swal.showValidationMessage('剩余份额不足');
                return val;
            }
        });

        if (amount) {
            const totalCost = parseFloat(ethers.utils.formatEther(p.sharePrice)) * amount;
            
            const confirm = await Swal.fire({
                title: '💰 支付确认',
                html: `
                    <div class="text-center">
                        <p class="text-gray-500 mb-1">您将支付</p>
                        <div class="text-3xl font-bold text-gray-900 mb-4">${totalCost.toFixed(4)} <span class="text-sm text-gray-400">ETH</span></div>
                        <p class="text-sm text-indigo-600 bg-indigo-50 py-2 rounded-lg">获得 ${amount} 份权益份额</p>
                    </div>
                `,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: '🚀 确认上链',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-2xl' }
            });

            if (confirm.isConfirmed) {
                onBuy(p.id, p.sharePrice, amount);
            }
        }
    };

    return (
        <div className="animate-fade-in space-y-8 pb-10">
            {/* 🌟 模块 1：市场概览 (保留你喜欢的黑色风格) */}
            <div className="relative bg-gray-900 rounded-3xl p-8 overflow-hidden shadow-2xl border border-gray-800">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-white space-y-2">
                        <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">🚀 早期融资市场 <span className="text-xs bg-indigo-600 px-2 py-0.5 rounded-full font-normal opacity-80">Beta</span></h2>
                        <p className="text-gray-400 max-w-md text-sm leading-relaxed">
                            发现高潜力的链上房产项目，成为早期股东。所有资产均已通过 NFT 确权，智能合约自动分账。
                        </p>
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="bg-white/5 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center min-w-[120px]">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">正在融资</div>
                            <div className="text-2xl font-bold text-white">{totalProjects} <span className="text-sm font-normal text-gray-500">个</span></div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center min-w-[120px]">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">剩余份额</div>
                            <div className="text-2xl font-bold text-emerald-400">{totalSharesAvailable} <span className="text-sm font-normal text-emerald-500/50">份</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 🌟 模块 2：项目列表 */}
            <div>
                <div className="flex items-center justify-between mb-6 px-2">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">🔥 热门项目</h3>
                    <div className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">按热度排序</div>
                </div>

                {activeList.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                        <div className="text-6xl mb-4 opacity-10 grayscale">🏙️</div>
                        <p className="text-gray-500 font-medium">市场暂时冷静</p>
                        <p className="text-gray-400 text-xs mt-2">没有正在融资的项目，去发布一个？</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeList.map(p => {
                            // 1. 核心逻辑：判断房东
                            const isLandlord = account && p.landlord && account.toLowerCase() === p.landlord.toLowerCase();

                            // 2. 数据转换 (BigNumber -> Number)
                            const sold = p.totalSharesSold && p.totalSharesSold.toNumber ? p.totalSharesSold.toNumber() : Number(p.totalSharesSold);
                            const endTime = p.investmentEndTime && p.investmentEndTime.toNumber ? p.investmentEndTime.toNumber() : Number(p.investmentEndTime);
                            // 权益周期 (如果合约返回了 rightsDuration，则显示，否则显示默认)
                            const rightsDuration = p.rightsDuration && p.rightsDuration.toString ? p.rightsDuration.toString() : '12';

                            const progress = sold;
                            const isHot = progress >= 80;
                            const isNew = progress <= 10;
                            
                            // 格式化日期
                            const endDateDisplay = endTime > 0 ? new Date(endTime * 1000).toLocaleDateString() : '-';

                            return (
                                <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden group h-full">
                                    {/* 卡片头部：渐变背景 */}
                                    <div className="h-40 bg-gradient-to-br from-indigo-600 to-purple-700 relative p-5 flex flex-col justify-between overflow-hidden">
                                        {/* 装饰圆圈 */}
                                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                                        
                                        <div className="flex justify-between items-start z-10">
                                            <div className="flex gap-2">
                                                <div className="bg-white/20 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10">
                                                    {p.propertyType}
                                                </div>
                                                {/* ✨ 新增：信誉星星 */}
                                                <ReputationStars score={p.reputation} />
                                            </div>
                                            
                                            <div className="flex gap-1">
                                                {isHot && <div className="bg-orange-500/90 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">🔥 抢手</div>}
                                                {isNew && <div className="bg-emerald-500/90 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">✨ 新上架</div>}
                                            </div>
                                        </div>
                                        
                                        <div className="text-white z-10">
                                            <h3 className="font-bold text-lg truncate drop-shadow-md tracking-tight">{p.name}</h3>
                                            <p className="text-xs text-indigo-100 opacity-90 truncate flex items-center gap-1 mt-0.5">
                                                📍 {p.physicalAddress}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 卡片主体 */}
                                    <div className="p-5 flex-1 flex flex-col gap-4">
                                        {/* 数据网格 (优化版) */}
                                        <div className="grid grid-cols-2 gap-2 text-center">
                                            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                                                <div className="text-[10px] text-gray-400 mb-0.5">单价 (ETH)</div>
                                                <div className="font-bold text-gray-800 text-sm">{ethers.utils.formatEther(p.sharePrice)}</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                                                <div className="text-[10px] text-gray-400 mb-0.5">剩余份数</div>
                                                <div className="font-bold text-indigo-600 text-sm">{100 - sold} <span className="text-[9px] text-gray-400 font-normal">/ 100</span></div>
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                                                <div className="text-[10px] text-gray-400 mb-0.5">权益周期</div>
                                                <div className="font-bold text-gray-700 text-sm">{rightsDuration} 个月</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                                                <div className="text-[10px] text-gray-400 mb-0.5">截止日期</div>
                                                <div className="font-bold text-gray-700 text-xs leading-5 pt-0.5">{endDateDisplay}</div>
                                            </div>
                                        </div>

                                        {/* 进度条 */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs items-end">
                                                <span className="text-gray-400 font-medium">融资进度</span>
                                                <span className="text-gray-800 font-bold font-mono">{progress}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${isHot ? 'bg-gradient-to-r from-orange-400 to-red-500' : 'bg-indigo-500'}`} 
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* 底部按钮 (带房东逻辑) */}
                                        <div className="mt-auto pt-2">
                                            <button 
                                                onClick={() => handleBuyClick(p, sold, endTime)}
                                                // ✅ 核心逻辑：如果是房东，或者正在加载，则禁用
                                                disabled={loadingMap[p.id] || isLandlord}
                                                className={`
                                                    w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 flex justify-center items-center gap-2
                                                    ${isLandlord 
                                                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none' // 房东样式
                                                        : 'bg-gray-900 hover:bg-gray-800 text-white shadow-gray-200' // 正常样式
                                                    }
                                                `}
                                            >
                                                {loadingMap[p.id] ? (
                                                    <React.Fragment><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div> 处理中...</React.Fragment>
                                                ) : (
                                                    // ✅ 按钮文字根据身份变化
                                                    isLandlord ? "🚫 您是房东" : <React.Fragment>⚡️ 立即投资</React.Fragment>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

window.InvestmentMarket = InvestmentMarket;