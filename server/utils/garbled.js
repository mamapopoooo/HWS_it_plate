// U+FFFD replacement char 是「文本在到达这里之前已经解码失败」的指纹。
// 典型场景：curl 或旧版 Excel 以 GBK 发送中文，服务端按 UTF-8 解码失败，替换符一旦入库，原文再也找不回来。
// 库里曾被这样写坏过 1 个学生中文名和 1 个班级名，所以名单写入口一律先挡。

const GARBLED = String.fromCharCode(0xfffd)

export const GARBLED_HINT = '内容有乱码替换符，说明表格或请求编码不是 UTF-8，已拒绝写入'

export function garbled(...vals) {
  return vals.some(v => typeof v === 'string' && v.includes(GARBLED))
}

/** 统计含乱码的行数（按学号、中文名、英文名、班级四列判断） */
export function garbledRows(rows) {
  return rows.filter(r => garbled(r.studentNo, r.name, r.nameEn, r.class)).length
}
