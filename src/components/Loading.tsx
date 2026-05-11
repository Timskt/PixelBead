export default function Loading() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-8">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-sm pixel-bounce"
          style={{
            backgroundColor: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFD93D", "#FF6B6B"][i],
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  )
}
