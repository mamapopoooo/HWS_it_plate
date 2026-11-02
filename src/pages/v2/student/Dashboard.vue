<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">我的首页</h1>
    <div class="grid grid-cols-2 gap-4">
      <router-link to="/student/pets" class="bg-gray-800 rounded-xl p-6 text-center hover:bg-gray-700 transition">
        <div class="text-3xl mb-2">🐾</div>
        <div class="font-bold">我的宠物</div>
      </router-link>
      <router-link to="/student/battle" class="bg-gray-800 rounded-xl p-6 text-center hover:bg-gray-700 transition">
        <div class="text-3xl mb-2">⚔️</div>
        <div class="font-bold">开始战斗</div>
      </router-link>
      <router-link to="/student/shop" class="bg-gray-800 rounded-xl p-6 text-center hover:bg-gray-700 transition">
        <div class="text-3xl mb-2">🛒</div>
        <div class="font-bold">积分商城</div>
      </router-link>
      <router-link to="/student/ranking" class="bg-gray-800 rounded-xl p-6 text-center hover:bg-gray-700 transition">
        <div class="text-3xl mb-2">🏆</div>
        <div class="font-bold">排行榜</div>
      </router-link>
    </div>
    <div class="mt-6 bg-gray-800 rounded-xl p-4">
      <h2 class="font-bold mb-2">最近积分变动</h2>
      <div class="text-gray-400 text-sm">暂无记录</div>
    </div>
  </div>
</template>
