package com.aegis.common.result;

/**
 * 统一接口返回包装。所有 Controller 的返回值一律是 Result&lt;T&gt;，
 * 前端只需要判 code === '0' 一种成功语义（方案文档 §2.3 交互协议）。
 *
 * 类比前端：相当于 axios 封装层里定义的 { code, message, data } 响应协议，
 * 两端字段名严格一致，前端拦截器才能统一处理错误。
 *
 * @param <T> data 的业务类型
 */
public class Result<T> {

    /** 成功码固定 "0"：短且不会与错误码混淆，前端判断最省事 */
    public static final String SUCCESS_CODE = "0";

    private final String code;
    private final String message;
    private final T data;

    private Result(String code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    /** 成功返回（带数据） */
    public static <T> Result<T> ok(T data) {
        return new Result<>(SUCCESS_CODE, "ok", data);
    }

    /** 成功返回（无数据，如删除/取消这类只需知道成功与否的操作） */
    public static Result<Void> ok() {
        return new Result<>(SUCCESS_CODE, "ok", null);
    }

    /** 失败返回：错误码 + 兜底文案 */
    public static <T> Result<T> fail(ErrorCode errorCode) {
        return new Result<>(errorCode.getCode(), errorCode.getMessage(), null);
    }

    /** 失败返回：错误码 + 覆盖文案（保留错误码语义的同时给出更具体的原因） */
    public static <T> Result<T> fail(ErrorCode errorCode, String message) {
        return new Result<>(errorCode.getCode(), message, null);
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public T getData() {
        return data;
    }
}
