import sql from "mssql"

const config: sql.config = {
  server: process.env.SQL_SERVER!,
  database: process.env.SQL_DATABASE!,
  user: process.env.SQL_USER!,
  password: process.env.SQL_PASSWORD!,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
}

let pool: sql.ConnectionPool | null = null

async function getPool() {
  if (pool) {
    return pool
  }

  pool = await sql.connect(config)
  return pool
}

export async function query<T = any>(
  sqlQuery: string,
  params?: Record<string, any>
): Promise<T[]> {
  const db = await getPool()
  const request = db.request()

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value)
    })
  }

  const result = await request.query(sqlQuery)
  return result.recordset as T[]
}