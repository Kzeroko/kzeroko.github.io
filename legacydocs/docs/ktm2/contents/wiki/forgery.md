---
layout: default
title: 装备锻造
parent: 自定义内容
nav_order: 1
has_toc: false
permalink: /ktm2/wiki/forgery
---

# 装备锻造

装备锻造是KTM2中独有的获取新装备的重要途径。整个锻造过程除去查看蓝图配方没有任何GUI内的互动，呈现出一个较为沉浸的合成方式

通过锻造获取的装备类型大致为武器、护甲、饰品、主/副手加成物品

后续计划的内容：`alloy-forgery`模组的兼容/依赖，更多品质的锻造锤，以及`铁匠`职业的兼容

铁匠职业兼容：铁匠锻造出的装备具有额外的物品稀有度，拥有稀有度保底且概率上调

<hr />

## 目录

[基本操作]({% link docs/ktm2/contents/wiki/forgery.md %}#基本操作)

[基础]({% link docs/ktm2/contents/wiki/forgery.md %}#基础)

[示例配方]({% link docs/ktm2/contents/wiki/forgery.md %}#示例配方)

[额外兼容]({% link docs/ktm2/contents/wiki/forgery.md %}#额外兼容)

<hr />

## 基本操作

锻造前，你需要明白一些基本操作

也在紧随其后的 [基础]({% link docs/ktm2/contents/wiki/forgery.md %}#基础) 中有所讲解

手持素材时：

- 对着锻造砧台面右键放入单个素材
- 对着锻造砧其他面右键放入手上能放入的所有素材

手持锻造锤时：

- 对着锻造砧台面右键收回最后放置的栏位的单个素材
- 对着锻造砧其他面右键收回最后放置的栏位的所有素材

手持有效蓝图时：

- 对着锻造砧任意面右键放入蓝图，不会消耗该物品

手持溶解药水时：

- 对着锻造砧任意面右键浇灌清除锻造状态，不会消耗含有的素材，但会消耗药水本身

<hr />

## 基础

![gif](/img/ktm2/wiki/forgery/r_forgery_idle.gif){: width="80%" }{: .center_img }

等待锻造中……
{: .text-delta .text-center }

锻造模块的基本逻辑为：任意物品，10以内数量的步骤（推荐，超出可能会有问题），最大可放入9个物品槽位，任意锻造数值（决定了锻造锤的敲击次数），锻造完成后输出任意单个物品

锻造模块用到的内容：蓝图（任意有效），锻造砧，锻造锤（任意品质），配方素材

<hr />

![gif](/img/ktm2/wiki/forgery/r_forgery_view_blueprint.gif){: width="80%" }{: .center_img }

查看蓝图配方
{: .text-delta .text-center }

手持有效蓝图，`SHIFT`+`使用键` 查看蓝图内的详细配方数据，`ESC`退出蓝图界面

<hr />

![gif](/img/ktm2/wiki/forgery/r_forgery_put_blueprint.gif){: width="80%" }{: .center_img }

放入蓝图
{: .text-delta .text-center }

锻造前需要放入有效的蓝图来锁定锻造状态，若为无效，则会提醒玩家当前为空白蓝图

操作方式：*主手手持，副手无效 <br />
主手手持有效的蓝图互动未含有蓝图的锻造砧来写入蓝图，蓝图不会被消耗，仅是拷贝一份在台面上

<hr />

![gif](/img/ktm2/wiki/forgery/r_forgery_put_ingredients.gif){: width="80%" }{: .center_img }

放入配方素材
{: .text-delta .text-center }

操作方式：*主手手持，副手无效 <br />
对锻造砧正上方互动放入手上的单个物品，对其它侧面互动放入手上的全组物品 <br />
主手手持锻造锤互动正上方取出最后栏位的单个物品，互动其它侧面则取出全组物品

<hr />

![gif](/img/ktm2/wiki/forgery/r_forgery_forging1.gif){: width="80%" }{: .center_img }

开始锻造
{: .text-delta .text-center }

锻造时需要玩家与锻造砧处于同水平线，锻造距离最大为一格半，且准星对准锻造砧台面，若是没有对准台面，则会提醒玩家对准准星

<hr />

![gif](/img/ktm2/wiki/forgery/r_forgery_clear.gif){: width="80%" }{: .center_img }

清空锻造状态
{: .text-delta .text-center }

主手手持`溶解药水`与锻造砧互动来清空当前的锻造状态，若是喝下该药水则是自杀效果，死于该药水有极小概率掉落`血肉溶解物`

*清空状态不包含锻造砧内还未消耗的配方素材

若是破坏锻造砧，同样可以清除锻造状态。任意工具挖掘锻造砧的速度都为一致，且锻造砧方块强度较高，这里不推荐通过挖掘来清空锻造状态

<hr />

## 示例配方

配方需要在 `data/模组名称/recipes/ise_forgery/配方ID.json` 下

配方类型ID为 `isekaiexpansion:forgery`

`result` 最终输出的物品

`steps` 锻造步骤的内容，尽量控制在10步以内

`forgery_progress` 锻造所需的锻造强度，如果到达则进入下一步；每把锻造锤会根据其稀有度提高每次的锻造强度，所以酌情考虑所需的量

`ingredients` 当前步骤所需的物品素材内容，保证不要超过9个项

`count` 当前步骤物品素材所需的量，保证数字在一组物品以内，即<=64

`item` 当前步骤物品素材的ID

`should_render_ingredients` 是否在当前步骤渲染放入的物品素材模型

`display_item` 当前步骤所展示的物品ID，并非一个实际可以获取的物品，仅供作渲染用；通常锻造的第一步不需要包含这项选项

```json{% raw %}
{
  "type": "isekaiexpansion:forgery",
  "result": {
    "item": "minecraft:diamond_sword"
  },
  "steps": [
    {
      "forgery_progress": 100,
      "ingredients": [
        {
          "count": 2,
          "item": "minecraft:iron_ingot"
        },
        {
          "count": 1,
          "item": "minecraft:stick"
        }
      ],
      "should_render_ingredients": true
    },
    {
      "display_item": "minecraft:iron_sword",
      "forgery_progress": 140,
      "ingredients": [
        {
          "count": 3,
          "item": "minecraft:diamond"
        },
        {
          "count": 1,
          "item": "minecraft:iron_ingot"
        },
        {
          "count": 2,
          "item": "minecraft:slime_ball"
        }
      ],
      "should_render_ingredients": true
    }
  ]
}
{% endraw %}
```

<hr />

## 额外兼容

一些模组的额外兼容，目前仅有Jade(玉)和REI的兼容

<hr />

![webp](/img/ktm2/wiki/forgery/compat/jade_waiting.webp){: width="80%" }{: .center_img }

锻造砧等待中
{: .text-delta .text-center }

<hr />

![webp](/img/ktm2/wiki/forgery/compat/jade_waiting_w_blueprint.webp){: width="80%" }{: .center_img }

锻造砧等待中（有蓝图的状态）
{: .text-delta .text-center }

<hr />

![webp](/img/ktm2/wiki/forgery/compat/jade_forging_w_ingredient.webp){: width="80%" }{: .center_img }

锻造中（放入对应素材后）
{: .text-delta .text-center }

<hr />

![webp](/img/ktm2/wiki/forgery/compat/jade_order_matters.webp){: width="80%" }{: .center_img }

再次提醒需要注意放入素材的顺序，否则就像这样无法继续锻造
{: .text-delta .text-center }

<hr />

![webp](/img/ktm2/wiki/forgery/compat/jade_forging_w_progress.webp){: width="80%" }{: .center_img }

锻造进度显示
{: .text-delta .text-center }

<hr />

![webp](/img/ktm2/wiki/forgery/compat/jade_forging_next_step_1.webp){: width="80%" }{: .center_img }

锻造进入下一步骤
{: .text-delta .text-center }

<hr />

![webp](/img/ktm2/wiki/forgery/compat/jade_forging_next_step_2.webp){: width="80%" }{: .center_img }

继续进行锻造
{: .text-delta .text-center }

<hr />

![webp](/img/ktm2/wiki/forgery/compat/jade_forging_success.webp){: width="80%" }{: .center_img }

成功进行一次酣畅淋漓的锻造！
{: .text-delta .text-center }

<hr />

![webp](/img/ktm2/wiki/forgery/compat/rei_compat_2.webp){: width="80%" }{: .center_img }

REI兼容，不会显示详细配方，但会显示什么物品可以被锻造出来
{: .text-delta .text-center }

<hr />