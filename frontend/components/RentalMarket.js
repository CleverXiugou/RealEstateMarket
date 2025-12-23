const { useState, useMemo } = React;

const RentalMarket = ({ properties, onRent, loadingMap }) => {
    // 状态管理
    const [filterTag, setFilterTag] = useState('all'); // all, cheap, luxury, large
    const [sortBy, setSortBy] = useState('newest'); // newest, price_asc, price_desc
    const [searchText, setSearchText] = useState('');

    const { STATUS_MAP } = window.AppConfig || { STATUS_MAP: [] };

    // --- 🎨 辅助函数：根据 ID 生成不同的渐变色背景 ---
    const getGradient = (id) => {
        const gradients = [
            'from-blue-400 to-indigo-600',
            'from-emerald-400 to-teal-600',
            'from-orange-400 to-pink-600',
            'from-purple-500 to-indigo-500',
            'from-cyan-400 to-blue-500'
        ];
        return gradients[id % gradients.length];
    };

    // --- 📊 数据处理逻辑 ---
    
    // 1. 基础筛选：只看 "待出租" (status === 3)
    const rawList = useMemo(() => properties.filter(p => p.status === 3), [properties]);

    // 2. 统计数据计算 (Idea 5: 市场看板)
    const stats = useMemo(() => {
        const count = rawList.length;
        if (count === 0) return { avgRent: 0, maxRent: 0, totalArea: 0 };
        
        let totalRent = 0;
        let maxRent = 0;
        let totalArea = 0;

        rawList.forEach(p => {
            const r = parseFloat(ethers.utils.formatEther(p.monthlyRent));
            totalRent += r;
            if (r > maxRent) maxRent = r;
            
            // ✅ [修复] p.area 已经是数字了，不要再调 .toNumber()
            // 使用 Number() 包裹是为了保险，防止它是字符串
            totalArea += p.area ? Number(p.area) : 0;
        });

        return {
            avgRent: (totalRent / count).toFixed(3),
            maxRent: maxRent.toFixed(3),
            totalArea: totalArea
        };
    }, [rawList]);

    // 3. 复杂筛选与排序 (Idea 2: 强力筛选)
    const filteredList = useMemo(() => {
        let result = [...rawList];

        // 搜索
        if (searchText) {
            const lower = searchText.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(lower) || p.physicalAddress.toLowerCase().includes(lower));
        }

        // 标签过滤
        if (filterTag === 'cheap') result = result.filter(p => parseFloat(ethers.utils.formatEther(p.monthlyRent)) < 10);
        if (filterTag === 'luxury') result = result.filter(p => parseFloat(ethers.utils.formatEther(p.monthlyRent)) >= 10);
        
        // ✅ [修复] 这里同样去掉 .toNumber()
        if (filterTag === 'large') result = result.filter(p => (p.area ? Number(p.area) : 0) > 100);

        // 排序
        if (sortBy === 'newest') result.sort((a, b) => b.id - a.id);
        if (sortBy === 'price_asc') result.sort((a, b) => parseFloat(ethers.utils.formatEther(a.monthlyRent)) - parseFloat(ethers.utils.formatEther(b.monthlyRent)));
        if (sortBy === 'price_desc') result.sort((a, b) => parseFloat(ethers.utils.formatEther(b.monthlyRent)) - parseFloat(ethers.utils.formatEther(a.monthlyRent)));

        return result;
    }, [rawList, searchText, filterTag, sortBy]);


    // --- 🧾 交互逻辑：收银台式支付 (Idea 4) ---
    const handleRentClick = async (p) => {
        // 第一步：询问租期
        const { value: months } = await Swal.fire({
            title: `租赁签约 - ${p.name}`,
            html: `
                <div class="text-left mb-4">
                    <p class="text-sm text-gray-500 mb-1">请输入您计划租赁的月数</p>
                    <div class="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 p-2 rounded border border-indigo-100">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>押金规则：押 3 付 N (合约自动锁定)</span>
                    </div>
                </div>
                <input id="rent-months" class="swal2-input" placeholder="例如: 12" type="number" min="1" value="12">
            `,
            showCancelButton: true,
            confirmButtonText: '下一步：确认账单',
            confirmButtonColor: '#4f46e5',
            preConfirm: () => {
                const val = document.getElementById('rent-months').value;
                if (!val || val < 1) Swal.showValidationMessage('请输入有效的月数');
                return val;
            }
        });

        if (months) {
            // 计算费用
            const rentPerMonth = p.monthlyRent; // BigNumber
            const rentPerMonthEth = parseFloat(ethers.utils.formatEther(rentPerMonth));
            
            const totalRent = rentPerMonth.mul(months);
            const deposit = rentPerMonth.mul(3);
            const totalPay = totalRent.add(deposit);

            // 第二步：展示详细账单 (Receipt)
            const confirm = await Swal.fire({
                title: '🧾 费用确认单',
                html: `
                    <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm">
                        <div class="flex justify-between items-center pb-2 border-b border-gray-200 mb-2">
                            <span class="text-gray-500">房产名称</span>
                            <span class="font-bold text-gray-800">${p.name}</span>
                        </div>
                        
                        <div class="space-y-2 mb-4">
                            <div class="flex justify-between">
                                <span class="text-gray-600">月租金</span>
                                <span>${rentPerMonthEth} ETH</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">租期</span>
                                <span>× ${months} 个月</span>
                            </div>
                            <div class="flex justify-between font-medium text-gray-800 pt-1">
                                <span>租金小计</span>
                                <span>${ethers.utils.formatEther(totalRent)} ETH</span>
                            </div>
                        </div>

                        <div class="bg-orange-50 p-3 rounded-lg border border-orange-100 flex justify-between items-center mb-4 text-orange-800">
                            <span class="flex items-center gap-1"><span class="text-xs">🔒</span> 押金 (可退)</span>
                            <span class="font-bold">${ethers.utils.formatEther(deposit)} ETH</span>
                        </div>

                        <div class="flex justify-between items-center pt-3 border-t border-gray-300">
                            <span class="text-base font-bold text-gray-800">总计应付</span>
                            <span class="text-xl font-black text-indigo-600">${ethers.utils.formatEther(totalPay)} ETH</span>
                        </div>
                    </div>
                    <div class="text-xs text-gray-400 mt-4 flex justify-center items-center gap-1">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        资金将直接进入智能合约托管
                    </div>
                `,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: '✨ 立即支付',
                confirmButtonColor: '#059669', // Emerald color
                reverseButtons: true
            });

            if (confirm.isConfirmed) {
                onRent(p.id, p.monthlyRent, deposit, months);
            }
        }
    };

    return (
        <div className="animate-fade-in space-y-8 pb-20">
            {/* 🌟 模块 1：市场看板 (Market Stats) */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-indigo-600/20 to-transparent"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                        🏙️ 租赁市场 
                        <span className="text-xs font-normal bg-white/10 px-2 py-1 rounded-full border border-white/20">Live</span>
                    </h2>
                    <div className="grid grid-cols-3 gap-8 divide-x divide-white/10">
                        <div>
                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">可租房源</div>
                            <div className="text-3xl font-bold">{rawList.length} <span className="text-sm font-normal text-gray-500">套</span></div>
                        </div>
                        <div className="pl-8">
                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">平均租金</div>
                            <div className="text-3xl font-bold text-emerald-400">{stats.avgRent} <span className="text-sm font-normal text-emerald-200/70">ETH/月</span></div>
                        </div>
                        <div className="pl-8">
                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">总供应面积</div>
                            <div className="text-3xl font-bold">{stats.totalArea} <span className="text-sm font-normal text-gray-500">㎡</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 🌟 模块 2：强力筛选栏 (Filter Bar) */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-20 z-30">
                {/* 左侧：搜索 */}
                <div className="relative w-full md:w-64">
                    <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                    <input 
                        type="text" 
                        placeholder="搜索房源名称或地址..." 
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                </div>

                {/* 中间：标签过滤器 */}
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
                    {[
                        { id: 'all', label: '全部房源' },
                        { id: 'cheap', label: '💎 实惠 (<10)' },
                        { id: 'luxury', label: '👑 豪华 (≥10)' },
                        { id: 'large', label: '🏡 大户型 (>100㎡)' },
                    ].map(tag => (
                        <button 
                            key={tag.id}
                            onClick={() => setFilterTag(tag.id)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                                filterTag === tag.id 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' 
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {tag.label}
                        </button>
                    ))}
                </div>

                {/* 右侧：排序 */}
                <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                    <option value="newest">📅 最新上架</option>
                    <option value="price_asc">💰 价格: 低 → 高</option>
                    <option value="price_desc">💎 价格: 高 → 低</option>
                </select>
            </div>

            {/* 🌟 模块 3：房源列表 (Card Grid) */}
            {filteredList.length === 0 ? (
                <div className="text-center py-32 bg-white rounded-3xl border border-dashed border-gray-200">
                    <div className="text-6xl mb-4 opacity-20">🏙️</div>
                    <p className="text-gray-500">暂时没有符合条件的待出租房源</p>
                    <button onClick={() => {setFilterTag('all'); setSearchText('');}} className="text-indigo-600 text-sm font-bold mt-2 hover:underline">清除筛选条件</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredList.map(p => {
                        const rentEth = ethers.utils.formatEther(p.monthlyRent);
                        return (
                            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full group overflow-hidden">
                                {/* 顶部渐变封面 (Idea 4 视觉升级) */}
                                <div className={`h-40 bg-gradient-to-br ${getGradient(p.id)} relative p-4 flex flex-col justify-between`}>
                                    <div className="flex justify-between items-start">
                                        <div className="bg-black/20 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20">
                                            #{p.id}
                                        </div>
                                        <div className="flex gap-1">
                                            <div className="bg-white/20 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                                                🛡️ 链上确权
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-white drop-shadow-md">
                                        <h3 className="font-bold text-lg truncate">{p.name}</h3>
                                        <p className="text-xs opacity-90 truncate flex items-center gap-1">📍 {p.physicalAddress}</p>
                                    </div>
                                </div>

                                <div className="p-5 flex-1 flex flex-col">
                                    {/* 特性标签 */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded">{p.propertyType}</span>
                                        {/* ✅ 修复: 直接使用 p.area (它已经是数字了) */}
                                        <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded">{p.area} ㎡</span>
                                        <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded">押三付N</span>
                                    </div>

                                    {/* 核心价格区 */}
                                    <div className="flex items-end justify-between mb-6">
                                        <div>
                                            <p className="text-xs text-gray-400 mb-0.5">月租金</p>
                                            <div className="text-2xl font-black text-indigo-600 flex items-baseline gap-1">
                                                {rentEth} <span className="text-xs font-normal text-gray-500">ETH</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400 mb-0.5">房东信誉</div>
                                            <div className="flex text-yellow-400 text-xs">★★★★★</div>
                                        </div>
                                    </div>

                                    {/* 底部按钮 */}
                                    <div className="mt-auto">
                                        <button 
                                            onClick={() => handleRentClick(p)}
                                            disabled={loadingMap[p.id]}
                                            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group-hover:bg-indigo-600"
                                        >
                                            {loadingMap[p.id] ? (
                                                <React.Fragment>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    签约中...
                                                </React.Fragment>
                                            ) : (
                                                <React.Fragment>
                                                    🔑 立即租赁
                                                </React.Fragment>
                                            )}
                                        </button>
                                        <p className="text-center text-[10px] text-gray-400 mt-2">智能合约担保 • 无中介费</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

window.RentalMarket = RentalMarket;