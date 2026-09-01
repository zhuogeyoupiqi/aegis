package com.aegis.common.result;

/**
 * 全局错误码。
 *
 * 编码规则（ SegmentFault 风格，前端可按 code 做差异化提示）：
 * - A 类：调用方问题（参数/校验），改请求就能解决
 * - B 类：业务规则拦截（如白名单），提示用户但不一定是"错误操作"
 * - C 类：服务端内部问题，前端只需提示"稍后再试"
 *
 * 类比前端：相当于前端 api 封装里约定的统一错误枚举，
 * 两端共用同一份语义（后续可挪进契约包由代码生成）。
 */
public enum ErrorCode {

    /** 参数校验失败（字段为空、格式不对、超范围） */
    BAD_PARAM("A0001", "参数错误"),

    /** 目标地址不在白名单网段内（SOC 安全红线：防止发包器被用作内网探测） */
    TARGET_NOT_ALLOWED("B0001", "目标地址不在白名单网段内"),

    /** 操作的对象不存在（任务 ID 查不到等） */
    NOT_FOUND("B0404", "资源不存在"),

    /** 任务状态不允许当前操作（如对已结束的任务再取消） */
    TASK_STATE_INVALID("B0002", "任务状态不允许该操作"),

    /** 未预期到的服务端错误（兜底，具体原因看服务端日志） */
    INTERNAL_ERROR("C5000", "服务内部错误");

    private final String code;
    private final String message;

    ErrorCode(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }
}
