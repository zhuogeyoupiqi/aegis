package com.aegis.framework.operator;

/**
 * "当前操作人"上下文接口。
 *
 * 为什么抽接口：审计留痕与 create_by 填充不关心"操作人从哪来"——
 * 当前实现是 SA-Token 登录人（SaTokenOperatorProvider），
 * 将来若做多账号体系 / 免登场景，只换实现，调用方一行不改。
 *
 * 类比前端：相当于 composable 里的依赖注入——
 * 组件只认 useUserStore() 这个接口，mock store 与真实 store 随时互换。
 */
public interface OperatorProvider {

    /** 未登录上下文的操作人标识（登录失败留痕、任务类初始化等） */
    String ANONYMOUS = "anonymous";

    /** 当前操作人标识：已登录返回登录名，未登录上下文（如登录失败留痕）返回 ANONYMOUS */
    String currentOperator();
}
