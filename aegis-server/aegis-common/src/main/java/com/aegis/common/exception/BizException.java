package com.aegis.common.exception;

import com.aegis.common.result.ErrorCode;

/**
 * 业务异常：Service 层遇到"业务规则不满足"时抛出，
 * 由 framework 的全局异常处理器统一转成 Result 返回。
 *
 * 为什么要分业务异常和普通异常：
 * 业务异常是"预期内的拒绝"（如白名单拦截），返回给用户看具体原因即可；
 * 普通异常是"程序 bug"，绝不能把堆栈暴露给前端，只记日志。
 *
 * 类比前端：相当于在 Pinia action 里 throw 一个带 code 的错误对象，
 * 由 axios 响应拦截器统一 toast，而不是每个调用点各写一遍。
 */
public class BizException extends RuntimeException {

    private final ErrorCode errorCode;

    public BizException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    /** 覆盖默认文案：同一错误码在不同场景下给更具体的提示 */
    public BizException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
