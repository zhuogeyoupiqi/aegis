package com.aegis.asset.repo;

import com.aegis.common.result.Result;
import com.aegis.framework.audit.AuditLog;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 资产仓库接口。查询不打审计（高频且只读），写操作留痕；
 * 复制计数端点刻意不打审计——它是"读"的伴随打点，一次浏览点十次很正常，
 * 打了只会把 sys_op_log 刷成复制流水，把真正有价值的增删改淹没掉。
 */
@RestController
@RequestMapping("/api/asset/items")
public class AssetItemController {

    private final AssetItemService itemService;

    public AssetItemController(AssetItemService itemService) {
        this.itemService = itemService;
    }

    /** 分页检索：关键字 / 类型 / 标签 三个条件全部可选 */
    @GetMapping
    public Result<ItemPageVO> page(
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String kw,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String tag) {
        return Result.ok(itemService.page(current, size, kw, type, tag));
    }

    /** 新增资产（detail 用固定文案：审计切面按方法入参名渲染占位符，DTO 入参取不到字段值） */
    @PostMapping
    @AuditLog(module = "asset", action = "create-item", detail = "新增资产条目")
    public Result<Void> create(@Valid @RequestBody ItemSaveDTO dto) {
        itemService.create(dto);
        return Result.ok();
    }

    /** 更新资产 */
    @PutMapping("/{id}")
    @AuditLog(module = "asset", action = "update-item", detail = "更新资产条目 {id}")
    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody ItemSaveDTO dto) {
        itemService.update(id, dto);
        return Result.ok();
    }

    /** 删除资产（逻辑删除，底账保留） */
    @DeleteMapping("/{id}")
    @AuditLog(module = "asset", action = "delete-item", detail = "删除资产条目 {id}")
    public Result<Void> delete(@PathVariable Long id) {
        itemService.delete(id);
        return Result.ok();
    }

    /** 复制计数自增（前端"复制到剪贴板"成功后打点，不打审计——见类注释） */
    @PostMapping("/{id}/copy")
    public Result<Void> copy(@PathVariable Long id) {
        itemService.incrementCopy(id);
        return Result.ok();
    }
}
