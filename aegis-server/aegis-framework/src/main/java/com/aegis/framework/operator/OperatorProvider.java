package com.aegis.framework.operator;

/**
 * "当前操作人"上下文接口。
 *
 * 为什么抽接口：登录（SA-Token）还没接入，但审计留痕与 create_by 填充
 * 从第一天就要有——先给本地开发态一个固定操作人的默认实现，
 * 登录接入后只需替换 Bean 实现，调用方一行不改。
 *
 * 类比前端：相当于 composable 里的依赖注入——
 * 组件只认 useUserStore() 这个接口，mock store 与真实 store 随时互换。
 */
public interface OperatorProvider {

    /** 当前操作人标识：接入登录后返回登录名，当前本地开发态返回 "local" */
    String currentOperator();
}
