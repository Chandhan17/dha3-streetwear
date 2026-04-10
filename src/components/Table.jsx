function Table({ columns = [], children }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111111] shadow-soft">
      <table className="w-full min-w-[760px]">
        <thead className="border-b border-white/10 bg-white/[0.02]">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export default Table
