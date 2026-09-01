package com.aegis.framework.audit;

import com.aegis.framework.operator.OperatorProvider;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 审计切面：拦截带 @AuditLog 的接口，动作完成后写一条 sys_op_log。
 *
 * 用 AOP 而不是在 Controller 里手动记：
 * 审计是横切关注点（cross-cutting concern），业务代码不该知道"自己正在被审计"。
 * 类比前端：路由守卫里做埋点，页面组件自身无感知，同一个道理。
 *
 * 注意留痕时机是"动作完成后"：失败的尝试也要记（success=false + 原因），
 * 只记成功等于没记。
 */
@Aspect
@Component
public class AuditAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);

    private final SysOpLogMapper opLogMapper;
    private final OperatorProvider operatorProvider;

    public AuditAspect(SysOpLogMapper opLogMapper, OperatorProvider operatorProvider) {
        this.opLogMapper = opLogMapper;
        this.operatorProvider = operatorProvider;
    }

    @Around("@annotation(auditLog)")
    public Object around(ProceedingJoinPoint joinPoint, AuditLog auditLog) throws Throwable {
        long start = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            // 成功也要等业务真正完成后再落库，所以记录动作放在 proceed 之后
            saveLog(joinPoint, auditLog, System.currentTimeMillis() - start, true, null);
            return result;
        } catch (Throwable e) {
            saveLog(joinPoint, auditLog, System.currentTimeMillis() - start, false, e.getMessage());
            // 异常必须原样抛出：审计不能吞掉业务异常，否则全局异常处理器收不到
            throw e;
        }
    }

    /** 组装并落一条审计记录；落库自身失败只记错误日志，绝不能影响业务接口 */
    private void saveLog(ProceedingJoinPoint joinPoint, AuditLog auditLog, long costMs, boolean success, String errorMsg) {
        try {
            SysOpLogDO row = new SysOpLogDO();
            row.setModule(auditLog.module());
            row.setAction(auditLog.action());
            row.setOperator(operatorProvider.currentOperator());
            row.setDetail(renderDetail(joinPoint, auditLog.detail()));
            row.setClientIp(currentClientIp());
            row.setCostMs(costMs);
            row.setSuccess(success);
            row.setErrorMsg(errorMsg);
            row.setOperateTime(LocalDateTime.now());
            opLogMapper.insert(row);
        } catch (Exception e) {
            log.error("审计落库失败 module={} action={}", auditLog.module(), auditLog.action(), e);
        }
    }

    /** 渲染 detail 模板里的 {参数名} 占位：与方法入参名对齐（编译需保留参数名，见 parent pom 编译参数） */
    private String renderDetail(ProceedingJoinPoint joinPoint, String template) {
        if (template == null || template.isEmpty()) {
            return "";
        }
        Map<String, String> params = collectParams(joinPoint);
        String rendered = template;
        for (Map.Entry<String, String> entry : params.entrySet()) {
            rendered = rendered.replace("{" + entry.getKey() + "}", entry.getValue());
        }
        return rendered;
    }

    /** 收集方法入参：参数名 → 值的字符串形式；只收简单类型，DTO 等复杂对象不进审计（避免明细膨胀） */
    private Map<String, String> collectParams(ProceedingJoinPoint joinPoint) {
        Map<String, String> params = new HashMap<>();
        String[] names = ((MethodSignature) joinPoint.getSignature()).getParameterNames();
        Object[] values = joinPoint.getArgs();
        if (names == null) {
            return params;
        }
        for (int i = 0; i < names.length && i < values.length; i++) {
            Object value = values[i];
            if (value == null) {
                params.put(names[i], "null");
            } else if (isSimpleType(value)) {
                params.put(names[i], String.valueOf(value));
            } else {
                // DTO / MultipartFile 等复杂对象：只留类型名，审计明细不放业务大对象
                params.put(names[i], value.getClass().getSimpleName());
            }
        }
        return params;
    }

    /** 简单类型 = 值本身就能读懂的类型（字符串/数字/布尔/枚举），其余一律视为复杂对象 */
    private boolean isSimpleType(Object value) {
        return value instanceof String || value instanceof Number || value instanceof Boolean
                || value instanceof Enum<?> || value instanceof java.time.temporal.Temporal;
    }

    /** 从当前请求上下文取调用方 IP；非 HTTP 上下文（定时任务等）返回 "-" */
    private String currentClientIp() {
        ServletRequestAttributes attrs =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) {
            return "-";
        }
        HttpServletRequest request = attrs.getRequest();
        return request.getRemoteAddr();
    }
}
