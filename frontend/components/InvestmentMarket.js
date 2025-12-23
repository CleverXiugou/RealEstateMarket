const InvestmentMarket = ({ properties, onBuy, loadingMap }) => {
    // 1. 只筛选处于 "融资中" (status === 1) 的项目
    const activeList = properties.filter(p => p.status === 1);

    // 2. 计算一些市场统计数据
    const totalProjects = activeList.length;
    
    // ✅ [修复] 必须先将 BigNumber 转为 number 才能累加
    const totalSharesAvailable = activeList.reduce((acc, p) => {
        // 安全转换：如果它是 BigNumber 就转，否则直接用
        const sold = p.totalSharesSold && p.totalSharesSold.toNumber ? p.totalSharesSold.toNumber() : 0;
        return acc + (100 - sold);
    }, 0);

    const totalMarketValue = activeList.reduce((acc, p) => {
        const price = parseFloat(ethers.utils.formatEther(p.sharePrice));
        return acc + (price * 100);
    }, 0);

    // 购买处理
    const handleBuyClick = async (p, sold, endTime) => {
        // 计算剩余天数
        const daysLeft = Math.max(0, Math.round((endTime - Date.now()/1000)/86400));
        const remainingShares = 100 - sold;

        const { value: amount } = await Swal.fire({
            title: `投资 - ${p.name}`,
            html: `
                <div class="text-left text-sm bg-gray-50 p-4 rounded-lg mb-4 space-y-2">
                    <div class="flex justify-between"><span>当前单价:</span><span class="font-bold text-indigo-600">${ethers.utils.formatEther(p.sharePrice)} ETH / 份</span></div>
                    <div class="flex justify-between"><span>剩余份额:</span><span class="font-bold">${remainingShares} 份</span></div>
                    <div class="flex justify-between"><span>融资周期:</span><span>${daysLeft} 天剩余</span></div>
                </div>
                <label class="block text-left text-sm text-gray-500 mb-1">请输入购买份数:</label>
                <input id="buy-amount" class="swal2-input" placeholder="例如: 5" type="number" min="1" max="${remainingShares}">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '确认投资',
            confirmButtonColor: '#4f46e5',
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
                title: '支付确认',
                text: `您将支付 ${totalCost.toFixed(4)} ETH 购买 ${amount} 份份额`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '支付 ETH',
                confirmButtonColor: '#4f46e5'
            });

            if (confirm.isConfirmed) {
                onBuy(p.id, p.sharePrice, amount);
            }
        }
    };

    return (
        <div className="animate-fade-in space-y-8">
            {/* 🌟 模块 1：市场概览 */}
            <div className="relative bg-gray-900 rounded-3xl p-8 overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-white space-y-2">
                        <h2 className="text-3xl font-black tracking-tight">🚀 早期融资市场</h2>
                        <p className="text-gray-400 max-w-md">
                            发现高潜力的链上房产项目，成为早期股东。所有资产均已通过 NFT 确权，租金收益自动分账。
                        </p>
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
                            <div className="text-xs text-gray-400 uppercase tracking-wider">正在融资</div>
                            <div className="text-2xl font-bold text-white">{totalProjects} <span className="text-sm font-normal">个</span></div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
                            <div className="text-xs text-gray-400 uppercase tracking-wider">市场规模</div>
                            <div className="text-2xl font-bold text-emerald-400">Ξ {totalMarketValue.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 🌟 模块 2：项目列表 */}
            <div>
                <div className="flex items-center justify-between mb-6 px-2">
                    <h3 className="text-xl font-bold text-gray-800">热门项目</h3>
                    <div className="text-sm text-gray-500">按发布时间排序 ↓</div>
                </div>

                {activeList.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                        <div className="text-6xl mb-4 opacity-20">📉</div>
                        <p className="text-gray-500">当前没有正在融资的项目</p>
                        <p className="text-gray-400 text-xs mt-2">请稍后再来看看，或去发布您自己的房产</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeList.map(p => {
                            // ✅ [核心修复] 将 BigNumber 转换为普通数字
                            // 如果 p.totalSharesSold 是 BigNumber，调用 .toNumber()，否则直接使用
                            const sold = p.totalSharesSold && p.totalSharesSold.toNumber ? p.totalSharesSold.toNumber() : Number(p.totalSharesSold);
                            
                            // 同样处理时间戳
                            const endTime = p.investmentEndTime && p.investmentEndTime.toNumber ? p.investmentEndTime.toNumber() : Number(p.investmentEndTime);

                            const progress = sold; // 现在 sold 是普通数字了
                            const isHot = progress >= 80;
                            const isNew = progress <= 10;
                            
                            return (
                                <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden group">
                                    <div className="h-36 bg-gradient-to-br from-indigo-600 to-purple-700 relative p-5 flex flex-col justify-between">
                                        <div className="flex justify-between items-start">
                                            <div className="bg-white/20 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded">
                                                {p.propertyType}
                                            </div>
                                            {isHot && <div className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">🔥 抢手</div>}
                                            {isNew && <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">✨ 新上架</div>}
                                        </div>
                                        <div className="text-white">
                                            <h3 className="font-bold text-lg truncate shadow-black/20 drop-shadow-md">{p.name}</h3>
                                            <p className="text-xs text-indigo-100 opacity-90 truncate flex items-center gap-1">
                                                📍 {p.physicalAddress}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-5 flex-1 flex flex-col gap-4">
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="bg-slate-50 rounded-lg p-2">
                                                <div className="text-[10px] text-gray-400">单价 (ETH)</div>
                                                <div className="font-bold text-gray-800 text-sm">{ethers.utils.formatEther(p.sharePrice)}</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-2">
                                                <div className="text-[10px] text-gray-400">面积 (㎡)</div>
                                                <div className="font-bold text-gray-800 text-sm">{p.area}</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-2">
                                                <div className="text-[10px] text-gray-400">剩余份数</div>
                                                {/* ✅ 修复：现在使用 100 - sold (数字减法) */}
                                                <div className="font-bold text-indigo-600 text-sm">{100 - sold}</div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-500 font-medium">融资进度</span>
                                                {/* ✅ 修复：直接显示数字 */}
                                                <span className="text-indigo-600 font-bold">{progress}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${isHot ? 'bg-gradient-to-r from-orange-400 to-red-500' : 'bg-indigo-500'}`} 
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-2">
                                            <button 
                                                // ✅ 传入处理好的数字 (sold, endTime)
                                                onClick={() => handleBuyClick(p, sold, endTime)}
                                                disabled={loadingMap[p.id]}
                                                className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-gray-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                            >
                                                {loadingMap[p.id] ? (
                                                    <React.Fragment>
                                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                        处理中...
                                                    </React.Fragment>
                                                ) : (
                                                    <React.Fragment>⚡️ 立即投资</React.Fragment>
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