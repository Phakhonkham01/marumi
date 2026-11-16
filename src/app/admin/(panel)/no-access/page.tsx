import Link from 'next/link'

export default function NoAccessPage() {
  return (
    <div className="card mx-auto max-w-md space-y-3 p-8 text-center">
      <p className="text-4xl">🔒</p>
      <h1 className="text-lg font-bold text-navy">ທ່ານບໍ່ມີສິດເຂົ້າໜ້ານີ້</h1>
      <p className="text-sm text-muted">ຖ້າຕ້ອງການໃຊ້ ໃຫ້ຂໍສິດຈາກເຈົ້າຂອງຮ້ານ ຫຼື ຜູ້ຈັດການພະນັກງານ</p>
      <Link href="/admin" className="btn btn-primary">
        ກັບໜ້າຫຼັກ
      </Link>
    </div>
  )
}
