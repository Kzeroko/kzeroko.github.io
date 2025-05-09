---
layout: default
title: 属性克制
parent: 自定义内容
nav_order: 4
has_toc: false
permalink: /ktm2/wiki/element
---

# 属性克制

属性克制是KTM2中的一项机制，在KTM2中，生物可能拥有不同的属性，或是不同的多个属性

不同种类的攻击对不同属性的生物有伤害倍率的加成与衰减

![png](/img/ktm2/wiki/element/arcane.png){: width="10%" }
![png](/img/ktm2/wiki/element/astral.png){: width="10%" }
![png](/img/ktm2/wiki/element/blast.png){: width="10%" }
![png](/img/ktm2/wiki/element/common.png){: width="10%" }
![png](/img/ktm2/wiki/element/dark.png){: width="10%" }
![png](/img/ktm2/wiki/element/dragon.png){: width="10%" }
![png](/img/ktm2/wiki/element/earth.png){: width="10%" }
![png](/img/ktm2/wiki/element/fire.png){: width="10%" }
![png](/img/ktm2/wiki/element/frost.png){: width="10%" }
![png](/img/ktm2/wiki/element/light.png){: width="10%" }
![png](/img/ktm2/wiki/element/lightning.png){: width="10%" }
![png](/img/ktm2/wiki/element/shard.png){: width="10%" }
![png](/img/ktm2/wiki/element/soul.png){: width="10%" }
![png](/img/ktm2/wiki/element/water.png){: width="10%" }
![png](/img/ktm2/wiki/element/wind.png){: width="10%" }

<hr />

## 伤害计算

如果使用非常有效伤害的攻击克制的属性时，获得+25%的伤害加成

如果使用效果不佳的伤害攻击克制的属性时，获得-25%的伤害衰减

多个属性的情况：

如果造成有效属性伤害的类别多于2个或是以上，则每层额外增加10%的加成

✎例：
```
假设你对 火、雷、土 属性的某只生物同时造成有效属性伤害，则会造成 125% + (2 * 10%)  = 145% 的伤害。
如果是攻击效果不佳的属性同理，最后则会造成 75% - (2 * 10%) = 55% 的伤害。
```
<hr />

## 伤害关系

<br />

![png](/img/ktm2/wiki/element/common.png){: width="10%" }

【普通属性】

✅ 对其非常有效的伤害：星界力

❌ 对其效果不佳的伤害：无

<hr />

![png](/img/ktm2/wiki/element/dragon.png){: width="10%" }

【龙属性】

✅ 对其非常有效的伤害：龙

❌ 对其效果不佳的伤害：所有

<hr />

![png](/img/ktm2/wiki/element/shard.png){: width="10%" }

【碎片属性/护甲系】

✅ 对其非常有效的伤害：灵魂、爆炸

❌ 对其效果不佳的伤害：三叉戟、荆棘、近战、土元素

<hr />

![png](/img/ktm2/wiki/element/arcane.png){: width="10%" }

【秘奥属性】

✅ 对其非常有效的伤害：奥秘、星界力

❌ 对其效果不佳的伤害：非法术魔法（如毒）、近战类法术

<hr />

![png](/img/ktm2/wiki/element/fire.png){: width="10%" }

【火属性】

✅ 对其非常有效的伤害：水元素、冰元素

❌ 对其效果不佳的伤害：火元素、火焰、风元素、爆炸

<hr />

![png](/img/ktm2/wiki/element/water.png){: width="10%" }

【水属性】

✅ 对其非常有效的伤害：冰元素、雷元素、雷电

❌ 对其效果不佳的伤害：火元素、火焰、水元素、近战

<hr />

![png](/img/ktm2/wiki/element/frost.png){: width="10%" }

【冰属性】

✅ 对其非常有效的伤害：近战、处刑、火元素、火焰

❌ 对其效果不佳的伤害：雷元素、雷电、冰元素、风元素、水元素

<hr />

![png](/img/ktm2/wiki/element/wind.png){: width="10%" }

【风属性】

✅ 对其非常有效的伤害：火元素、火焰

❌ 对其效果不佳的伤害：荆棘、雷元素、雷电、近战

<hr />

![png](/img/ktm2/wiki/element/earth.png){: width="10%" }

【土属性】

✅ 对其非常有效的伤害：爆炸、土元素

❌ 对其效果不佳的伤害：三叉戟、荆棘、近战、通常、风元素、雷电、雷元素

<hr />

![png](/img/ktm2/wiki/element/soul.png){: width="10%" }

【灵魂属性】

✅ 对其非常有效的伤害：光明、黑暗、治愈

❌ 对其效果不佳的伤害：灵魂、处刑、近战、通常、荆棘、星界力

<hr />

![png](/img/ktm2/wiki/element/astral.png){: width="10%" }

【星界属性】

✅ 对其非常有效的伤害：灵魂

❌ 对其效果不佳的伤害：光明、黑暗、奥秘

<hr />

![png](/img/ktm2/wiki/element/light.png){: width="10%" }

【光属性】

✅ 对其非常有效的伤害：黑暗、凋零

❌ 对其效果不佳的伤害：所有

<hr />

![png](/img/ktm2/wiki/element/dark.png){: width="10%" }

【暗属性】

✅ 对其非常有效的伤害：光明、治愈

❌ 对其效果不佳的伤害：所有

<hr />

P.S. 未提及的则造成正常伤害，并非最终版本，后续可能会有改动

<hr />
