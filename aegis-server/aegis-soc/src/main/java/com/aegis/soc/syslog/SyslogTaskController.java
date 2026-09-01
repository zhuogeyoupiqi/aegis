package com.aegis.soc.syslog;

import com.aegis.common.result.Result;
import com.aegis.framework.audit.AuditLog;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * syslog 发包接口。Controller 只做参数校验和转发（方案文档分层约定），
 * 业务规则全部在 SyslogSendService。
 */
@RestController
@RequestMapping("/api/syslog/tasks")
public class SyslogTaskController {

    private final SyslogSendService sendService;
    private final SendEventHub hub;

    public SyslogTaskController(SyslogSendService sendService, SendEventHub hub) {
        this.sendService = sendService;
        this.hub = hub;
    }

    /**
     * 历史任务列表（分页，新的在前）。只读查询不打审计——
     * 审计记"做了什么动作"，翻历史不是动作。
     */
    @GetMapping
    public Result<HistoryPageVO> history(
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "20") int size) {
        return Result.ok(sendService.pageHistory(current, size));
    }

    /** 一键清空终态任务（逻辑删除），返回清理条数；RUNNING 任务不受影响 */
    @DeleteMapping
    @AuditLog(module = "syslog", action = "clear-history", detail = "清空已结束的历史任务")
    public Result<Integer> clearFinished() {
        return Result.ok(sendService.clearFinishedTasks());
    }

    /**
     * 删除单条历史任务（逻辑删除：deleted=1，查询自动过滤，底账保留）。
     * RUNNING 状态会被 Service 拒绝（B0002），防止删掉发送线程还要回写的行。
     */
    @DeleteMapping("/{taskId}")
    @AuditLog(module = "syslog", action = "delete-task", detail = "删除历史任务 {taskId}")
    public Result<Void> delete(@PathVariable Long taskId) {
        sendService.deleteTask(taskId);
        return Result.ok();
    }

    /**
     * 创建发送任务：白名单校验通过即返回 taskId（不等发送完成——发多久由条数/间隔决定）。
     * 审计 detail 不放 DTO 字段（切面只展开简单类型入参），完整留痕看 soc_send_task 表。
     */
    @PostMapping
    @AuditLog(module = "syslog", action = "send-task", detail = "创建发送任务（详情见 soc_send_task 表）")
    public Result<TaskCreatedVO> create(@Valid @RequestBody TaskCreateDTO dto) {
        return Result.ok(sendService.createTask(dto));
    }

    /**
     * 订阅任务事件流（SSE）。
     * 注意返回的是 SseEmitter 而不是 Result：SSE 是长连接推送通道，
     * 统一 Result 包装只适用于"一问一答"的 REST 语义，通道有自己的事件协议
     * （line / stats / done 三种事件，见 SyslogEvents）。
     */
    @GetMapping(value = "/{taskId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@PathVariable Long taskId) {
        return hub.subscribe(taskId);
    }

    /** 取消运行中的任务 */
    @PostMapping("/{taskId}/cancel")
    @AuditLog(module = "syslog", action = "cancel", detail = "取消任务 {taskId}")
    public Result<Void> cancel(@PathVariable Long taskId) {
        sendService.cancelTask(taskId);
        return Result.ok();
    }
}
