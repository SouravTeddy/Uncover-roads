interface Props {
  onClose: () => void;
}

export function RecSheet({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 flex items-end z-50"
      style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full bg-surface rounded-t-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '70vh' }}
      >
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <h3 className="font-heading font-bold text-text-1 text-base">Suggestions</h3>
          <button onClick={onClose} className="ms text-text-3 text-base">close</button>
        </div>
        <div className="flex flex-col items-center py-12 text-text-3 text-sm gap-2">
          <span className="ms text-3xl">auto_awesome</span>
          <p>Recommendations coming soon</p>
        </div>
      </div>
    </div>
  );
}
