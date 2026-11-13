"""读取 26 下班级名单 xlsx，导出为 UTF-8 JSON，供墨境导入。"""
import json
import glob
import os
import re
import warnings

warnings.filterwarnings('ignore')
import openpyxl

SRC = r'D:\德育工作\26下班级名单'
OUT = r'D:\课件\platform\pet-garden-qoder\docs\seeds\students-real.json'

rows = []
report = []

for path in sorted(glob.glob(os.path.join(SRC, '*.xlsx'))):
    cls_name = os.path.splitext(os.path.basename(path))[0]
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.worksheets[0]
    header = [str(c).strip() if c is not None else '' for c in
              next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    n = 0
    for r in ws.iter_rows(min_row=2, values_only=True):
        if r is None or all(c is None or str(c).strip() == '' for c in r):
            continue
        rec = {header[i]: (str(r[i]).strip() if r[i] is not None else '')
               for i in range(min(len(header), len(r)))}
        no = rec.get('学号', '')
        cn = rec.get('中文名', '') or rec.get('姓名', '')
        en = rec.get('英文名', '')
        if not no or not cn:
            continue
        rows.append({
            'studentNo': no,
            'name': cn,
            'nameEn': en,
            'gender': rec.get('性别', ''),
            'class': rec.get('班级', '') or cls_name,
            'course': rec.get('课程', ''),
        })
        n += 1
    report.append((cls_name, n, header))

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

print('=== 表头与各班人数 ===')
for cls, n, header in report:
    print(f'  {cls:<12} {n:>3} 人   表头={header}')
print(f'\n合计 {len(rows)} 名学生 → {OUT}')

# 数据质量检查
nos = [r['studentNo'] for r in rows]
dup = {x for x in nos if nos.count(x) > 1}
print(f'学号重复: {sorted(dup) if dup else "无"}')
print(f'学号非纯数字: {[x for x in nos if not re.fullmatch(r"\\d+", x)] or "无"}')
no_en = [r for r in rows if not r['nameEn']]
print(f'缺英文名: {len(no_en)} 人')
# 英文名里是否含空格/中文名，以及重名
ens = [r['nameEn'] for r in rows if r['nameEn']]
dupen = {x for x in ens if ens.count(x) > 1}
print(f'英文名重复: {sorted(dupen) if dupen else "无"}')
print(f'学号长度分布: {sorted({len(x) for x in nos})}')
