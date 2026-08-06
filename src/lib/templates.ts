import type { Template } from "@/types/domain";

export const starterTemplates: Template[] = [
  {
    id: "tpl_survival",
    title: "文字生存模拟",
    category: "生存选择",
    prompt:
      "做一个高山徒步生存模拟器。玩家每天做 2-3 个选择，选择影响体力、温度、饥饿和救援概率，要有多结局、状态条和最终评级。",
    tags: ["剧情", "选择", "多结局"],
    recommendedMode: "staged"
  },
  {
    id: "tpl_party_board",
    title: "聚会飞行棋",
    category: "多人聚会",
    prompt:
      "做一个适合朋友聚会玩的飞行棋 H5。支持 2-4 名玩家输入名字，轮流掷骰子前进，有加速格、后退格、幸运格和胜利庆祝。",
    tags: ["聚会", "骰子", "多人"],
    recommendedMode: "plan_once"
  },
  {
    id: "tpl_quiz",
    title: "趣味人格测试",
    category: "测验裂变",
    prompt:
      "做一个年轻幽默的人格测试 H5。用户回答 10 道选择题，最后生成一个有网感的人格标签、性格描述、雷达图和可截图结果页。",
    tags: ["测试", "分享", "结果页"],
    recommendedMode: "direct"
  },
  {
    id: "tpl_runner",
    title: "热点跑酷复刻",
    category: "休闲挑战",
    prompt:
      "做一个手机端横版跑酷小游戏。玩家点击跳跃躲避障碍，收集金币，速度逐渐加快，失败后显示分数和重新开始。",
    tags: ["跑酷", "挑战", "移动端"],
    recommendedMode: "direct"
  },
  {
    id: "tpl_memory",
    title: "记忆翻牌",
    category: "轻量游戏",
    prompt:
      "做一个 4x4 记忆翻牌游戏。卡牌背面一致，翻开后显示不同图案，匹配成功保留，全部匹配后胜利，有步数和计时。",
    tags: ["翻牌", "计时", "休闲"],
    recommendedMode: "direct"
  },
  {
    id: "tpl_lantern",
    title: "节日猜谜",
    category: "节日互动",
    prompt:
      "做一个元宵猜灯谜 H5。玩家回答 10 道灯谜，每题 4 个选项，答对点亮灯笼，最后按得分生成称号和祝福卡。",
    tags: ["节日", "问答", "运营"],
    recommendedMode: "plan_once"
  }
];
