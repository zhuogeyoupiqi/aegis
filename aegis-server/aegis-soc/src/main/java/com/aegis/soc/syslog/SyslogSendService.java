package com.aegis.soc.syslog;

import com.aegis.common.exception.BizException;
import com.aegis.common.result.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.Executor;

/**
 * syslog 发送编排：校验 → 落任务行 → 提交发送线程。
 *
 * Controller 只转发，这里才是业务规则的唯一入口
 * （白名单、条数节奏上限、状态流转都在这一层收口）。
 */
@Service
public class SyslogSendService {

    private static final Logger log = LoggerFactory.getLogger(SyslogSendService.class);

    /** 报文预览的入库长度上限：审计够看就行，完整内容不留大字段 */
    private static final int PREVIEW_LIMIT = 512;

    /**
     * 终态集合：删除/清空只作用于已结束的任务。
     * RUNNING 行还被发送线程持有（收尾时会回写统计），删了它就会出现
     * "已删除却仍被更新"的幽灵数据，所以一律拒绝。
     */
    private static final List<String> FINISHED_STATUSES = List.of(
            SocSendTaskDO.STATUS_DONE, SocSendTaskDO.STATUS_CANCELLED, SocSendTaskDO.STATUS_FAILED);

    private final SocSendTaskMapper taskMapper;
    private final SyslogWhitelistService whitelistService;
    private final SendEventHub hub;
    private final Executor sendExecutor;

    public SyslogSendService(SocSendTaskMapper taskMapper,
                             SyslogWhitelistService whitelistService,
                             SendEventHub hub,
                             @Qualifier("syslogSendExecutor") Executor sendExecutor) {
        this.taskMapper = taskMapper;
        this.whitelistService = whitelistService;
        this.hub = hub;
        this.sendExecutor = sendExecutor;
    }

    /**
     * 创建并启动发送任务。
     * 白名单不通过会抛 BizException（任务不落库——被拒绝的尝试已由审计切面记录）。
     */
    public TaskCreatedVO createTask(TaskCreateDTO dto) {
        whitelistService.checkTargetAllowed(dto.getTargetIp());

        SocSendTaskDO task = new SocSendTaskDO();
        task.setTargetIp(dto.getTargetIp());
        task.setTargetPort(dto.getTargetPort());
        task.setProtocol("udp");
        task.setTemplateKey(dto.getTemplateKey());
        // 只存首条报文的预览：留痕要的是"当时发了什么格式的东西"，不是全文备份
        String first = dto.getPayloads().get(0);
        task.setPayloadPreview(first.length() > PREVIEW_LIMIT ? first.substring(0, PREVIEW_LIMIT) : first);
        // 条数 = 报文列表长度（DTO 已不单独传 count，避免两个数字对不上）
        task.setTotalCount(dto.getPayloads().size());
        task.setIntervalMs(dto.getIntervalMs());
        task.setSentCount(0);
        task.setFailedCount(0);
        task.setStatus(SocSendTaskDO.STATUS_RUNNING);
        task.setStartTime(LocalDateTime.now());
        taskMapper.insert(task);

        // 先建事件通道再提交发送：杜绝"发送线程先 publish、通道还没建"的竞态
        hub.create(task.getId());
        sendExecutor.execute(new UdpSendTaskRunner(taskMapper, hub, task, dto.getPayloads()));

        return new TaskCreatedVO(task.getId());
    }

    /** 取消运行中的任务：只是打标记，真正的收尾由发送线程自己在下一轮完成 */
    public void cancelTask(long taskId) {
        if (!hub.requestCancel(taskId)) {
            throw new BizException(ErrorCode.TASK_STATE_INVALID, "任务不存在或已结束，无法取消");
        }
    }

    /**
     * 分页查询历史任务（新的在前）。单页上限 100 防手滑翻全表，
     * 分页插件（PaginationInnerInterceptor）在 MybatisPlusConfig 已装配。
     */
    public HistoryPageVO pageHistory(int current, int size) {
        Page<SocSendTaskDO> page = taskMapper.selectPage(
                new Page<>(current, Math.min(Math.max(size, 1), 100)),
                new LambdaQueryWrapper<SocSendTaskDO>()
                        .orderByDesc(SocSendTaskDO::getCreateTime));
        return new HistoryPageVO(page.getTotal(),
                page.getRecords().stream().map(TaskHistoryVO::from).toList());
    }

    /**
     * 删除单条历史任务。走 MyBatis-Plus 逻辑删除（deleted=1，查询自动过滤）：
     * 界面上"删掉了"，但底账还在库里——既满足个人清理诉求，又不破坏留痕语义。
     * selectById 查不到已逻辑删除的行，重复删除会得到 NOT_FOUND，天然幂等。
     */
    public void deleteTask(long taskId) {
        SocSendTaskDO task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "任务不存在或已删除");
        }
        if (!FINISHED_STATUSES.contains(task.getStatus())) {
            throw new BizException(ErrorCode.TASK_STATE_INVALID, "任务仍在运行，请先停止再删除");
        }
        taskMapper.deleteById(taskId);
    }

    /**
     * 一键清空全部终态任务（同样走逻辑删除），返回清理条数供前端提示。
     * delete(wrapper) 是批量逻辑删除，RUNNING 行不在条件内、不受影响。
     */
    public int clearFinishedTasks() {
        return taskMapper.delete(new LambdaQueryWrapper<SocSendTaskDO>()
                .in(SocSendTaskDO::getStatus, FINISHED_STATUSES));
    }

    /**
     * 服务启动时收尾孤儿任务：上次运行被 Ctrl-C / 重启打断的任务会永远停在 RUNNING，
     * 统一改成 FAILED，历史数据才不会误导排查。
     */
    @EventListener(ApplicationReadyEvent.class)
    public void markOrphanTasksFailed() {
        int updated = taskMapper.update(null, new LambdaUpdateWrapper<SocSendTaskDO>()
                .eq(SocSendTaskDO::getStatus, SocSendTaskDO.STATUS_RUNNING)
                .set(SocSendTaskDO::getStatus, SocSendTaskDO.STATUS_FAILED)
                .set(SocSendTaskDO::getErrorMsg, "服务重启导致任务中断"));
        if (updated > 0) {
            log.warn("启动收尾：{} 个历史 RUNNING 任务已标记为 FAILED", updated);
        }
    }
}
