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

<hr />

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
