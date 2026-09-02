package com.aegis.framework.web;

import cn.dev33.satoken.exception.NotLoginException;
import com.aegis.common.exception.BizException;
import com.aegis.common.result.ErrorCode;
import com.aegis.common.result.Result;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理器：Controller / Service 抛出的异常在这里统一转成 Result，
 * 业务代码只管抛 BizException，不用每个接口写 try-catch。
 *
 * 类比前端：相当于 axios 响应拦截器里统一 toast 错误——
 * 调用点不再各自处理错误，错误出口只有一个。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 业务异常：预期内的拒绝，原因直接给用户看 */
    @ExceptionHandler(BizException.class)
    public Result<Void> handleBiz(BizException e) {
        return Result.fail(e.getErrorCode(), e.getMessage());
    }

    /**
     * 未登录 / 会话失效：SA-Token 拦截器或 StpUtil 校验抛出。
     * 保持项目"HTTP 200 + Result.code"风格（A0401），前端按 code 分支处理——
     * 单独给未登录改 HTTP 401 会让两套前端各开一条特殊分支，收益为零。
     * 按场景值给差异化文案，前端 toast 出来用户才知道该干嘛。
     */
    @ExceptionHandler(NotLoginException.class)
    public Result<Void> handleNotLogin(NotLoginException e) {
        String message = switch (e.getType()) {
            case NotLoginException.NOT_TOKEN -> "未登录，请先登录";
            case NotLoginException.INVALID_TOKEN -> "登录凭证无效，请重新登录";
            case NotLoginException.TOKEN_TIMEOUT -> "登录已过期，请重新登录";
            case NotLoginException.NO_PREFIX -> "凭证格式错误（缺少 Bearer 前缀）";
            default -> ErrorCode.UNAUTHORIZED.getMessage();
        };
        return Result.fail(ErrorCode.UNAUTHORIZED, message);
    }

    /**
     * 参数校验失败：@Valid 校验不通过时抛出。
     * 只取第一条错误信息返回——一次全量吐出去用户反而不知道先改哪个。
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidation(MethodArgumentNotValidException e) {
        String firstError = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(err -> err.getField() + " " + err.getDefaultMessage())
                .orElse(ErrorCode.BAD_PARAM.getMessage());
        return Result.fail(ErrorCode.BAD_PARAM, firstError);
    }

    /** 兜底异常：程序 bug，绝不把堆栈信息暴露给前端，细节只进日志 */
    @ExceptionHandler(Exception.class)
    public Result<Void> handleUnknown(Exception e) {
        log.error("未处理异常", e);
        return Result.fail(ErrorCode.INTERNAL_ERROR);
    }
}
