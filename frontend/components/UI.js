// 加载状态按钮
const Button = ({ onClick, loading, children, className = "", disabled, variant = "primary" }) => {
    const baseStyle = "px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-indigo-600 text-white hover:bg-indigo-700",
        outline: "border border-indigo-600 text-indigo-600 hover:bg-indigo-50",
        danger: "bg-red-500 text-white hover:bg-red-600",
        success: "bg-green-600 text-white hover:bg-green-700",
        warning: "bg-yellow-500 text-white hover:bg-yellow-600"
    };

    return (
        <button 
            onClick={onClick} 
            disabled={loading || disabled} 
            className={`${baseStyle} ${variants[variant]} ${className}`}
        >
            {loading && <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>}
            {children}
        </button>
    );
};

// 全局 Toast 通知容器
const ToastContainer = ({ toasts }) => {
    return (
        <div className="fixed top-4 right-4 z-50 space-y-3">
            {toasts.map(t => (
                <div key={t.id} className={`p-4 rounded-lg shadow-lg text-white transform transition-all animate-slide-in flex items-center gap-3 ${
                    t.type === 'error' ? 'bg-red-500' : 'bg-green-600'
                }`}>
                    <span>{t.type === 'error' ? '❌' : '✅'}</span>
                    <p>{t.msg}</p>
                </div>
            ))}
        </div>
    );
};

// 复制小组件
const CopyText = ({ text, label }) => {
    const [copied, setCopied] = React.useState(false);
    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div onClick={handleCopy} className="group cursor-pointer flex items-center gap-1 text-gray-500 hover:text-indigo-600" title="点击复制">
            <span className="text-xs">{label || text}</span>
            {copied ? <span className="text-xs text-green-600 font-bold">已复制</span> : <span className="text-xs opacity-0 group-hover:opacity-100">📋</span>}
        </div>
    );
};

// 简单的搜索框
const SearchBar = ({ value, onChange, placeholder = "搜索..." }) => (
    <div className="relative">
        <input 
            type="text" 
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
        />
        <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
    </div>
);

// 挂载
window.UI = { Button, ToastContainer, CopyText, SearchBar };