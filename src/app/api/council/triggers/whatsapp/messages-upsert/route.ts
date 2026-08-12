import { NextRequest } from 'next/server'
import { POST as basePost, GET } from '../route'
export { GET }
export async function POST(req: NextRequest) { return basePost(req) }
