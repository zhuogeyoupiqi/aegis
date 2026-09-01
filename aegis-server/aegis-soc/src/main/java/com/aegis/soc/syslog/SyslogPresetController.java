package com.aegis.soc.syslog;

import com.aegis.common.result.Result;
import com.aegis.framework.audit.AuditLog;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 发送配置预设接口（"保存任务"按钮的读写端）。
 * 查询不打审计（高频且只读），写操作留痕。
 */
@RestController
@RequestMapping("/api/syslog/presets")
public class SyslogPresetController {

    private final SyslogPresetService presetService;

    public SyslogPresetController(SyslogPresetService presetService) {
        this.presetService = presetService;
    }

    /** 预设列表（个人工具量级，不做分页） */
    @GetMapping
    public Result<List<PresetVO>> list() {
        return Result.ok(presetService.list());
    }

    /** 保存当前表单为预设 */
    @PostMapping
    @AuditLog(module = "syslog", action = "save-preset", detail = "保存发送配置预设 {name}")
    public Result<Void> create(@Valid @RequestBody PresetCreateDTO dto) {
        presetService.create(dto);
        return Result.ok();
    }

    /** 删除预设 */
    @DeleteMapping("/{id}")
    @AuditLog(module = "syslog", action = "delete-preset", detail = "删除发送配置预设 {id}")
    public Result<Void> delete(@PathVariable Long id) {
        presetService.delete(id);
        return Result.ok();
    }
}
