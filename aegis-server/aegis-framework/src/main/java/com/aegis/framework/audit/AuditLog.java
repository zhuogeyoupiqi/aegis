package com.aegis.framework.audit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 操作审计注解：标在 Controller 方法上，AuditAspect 会自动落一条 sys_op_log。
 *
 * 哪些接口要标：有副作用的关键动作（发包、删除、改配置）。
 * 查询类不标——审计要的是"谁动了什么"，不是访问流水。
 *
 * 类比前端：相当于给 Pinia action 挂一个记录插件，
 * 声明一下"这个动作要被记录"，记录逻辑本身零侵入。
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface AuditLog {

    /** 业务模块：syslog / asset / system ... */
    String module();

    /** 动作名：send-task / cancel / delete ...（动词开头，和前端事件命名习惯一致） */
    String action();

    /** 操作对象的描述模板，支持 {参数名} 占位，如 "任务{taskId} 发往{targetIp}" */
    String detail() default "";
}
