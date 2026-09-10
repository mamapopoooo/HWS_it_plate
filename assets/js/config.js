/* 平台部署常量集中配置。教师只需改这里。
   petBase = 校内局域网里 class-pet-garden（网宠/加减分）服务地址。
   公网（GitHub Pages）访问时该地址不可达，pet.html 会显示"需校内访问"提示。 */
window.PLATFORM_CONFIG = {
  // 教师机运行 node server/index.js 后的局域网地址（按实际 IP/端口修改）
  petBase: 'http://192.168.1.10:3000/pet-garden/',
  // 探测超时（毫秒）
  petProbeTimeout: 2500
};
