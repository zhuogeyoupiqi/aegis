package com.aegis.asset.repo;

import com.aegis.common.exception.BizException;
import com.aegis.common.result.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 资产仓库的读写与检索。
 *
 * 检索按方案文档 §5.3 的 MVP 口径：MySQL LIKE + 标签精确匹配（FIND_IN_SET），
 * 个人库量级（几百条）全表扫无感；量级上来再演进 Meilisearch，接口形状不变。
 * 默认排序 copy_count 降序——复制次数是"这资产我常 用"的最诚实信号。
 */
@Service
public class AssetItemService {

    /** 标签上限：多了说明该拆资产了，筛选项也会被稀释 */
    private static final int MAX_TAGS = 8;

    private final AssetItemMapper itemMapper;

    public AssetItemService(AssetItemMapper itemMapper) {
        this.itemMapper = itemMapper;
    }

    /**
     * 分页检索：关键字（名字/说明/正文三列模糊）+ 类型精确 + 标签精确，全部可选组合。
     * 标签用 FIND_IN_SET 而不是 LIKE：逗号串里 LIKE "%java%" 会误中 "javascript"，
     * FIND_IN_SET 按整段精确比较，天然规避前缀歧义。
     */
    public ItemPageVO page(int current, int size, String kw, String type, String tag) {
        String keyword = trimToNull(kw);
        String typeVal = trimToNull(type);
        String tagVal = trimToNull(tag);

        LambdaQueryWrapper<AssetItemDO> wrapper = new LambdaQueryWrapper<AssetItemDO>()
                .eq(typeVal != null, AssetItemDO::getType, typeVal)
                .apply(tagVal != null, "FIND_IN_SET({0}, tags)", tagVal)
                // 关键字是"任一列命中即算"的 OR 语义，and(...) 包一层避免污染外层条件的 AND 链
                .and(keyword != null, w -> w.like(AssetItemDO::getName, keyword)
                        .or().like(AssetItemDO::getDescription, keyword)
                        .or().like(AssetItemDO::getContent, keyword))
                .orderByDesc(AssetItemDO::getCopyCount)
                .orderByDesc(AssetItemDO::getUpdateTime);

        Page<AssetItemDO> page = itemMapper.selectPage(
                // 单页上限 100：防手滑翻全表，个人库也远用不到
                new Page<>(current, Math.min(Math.max(size, 1), 100)), wrapper);
        return new ItemPageVO(page.getTotal(), page.getRecords().stream().map(ItemVO::from).toList());
    }

    /** 新增资产：copy_count 显式置 0（不依赖列默认值，读到 null 的排查成本更高） */
    public void create(ItemSaveDTO dto) {
        AssetItemDO item = new AssetItemDO();
        applyFields(item, dto);
        item.setCopyCount(0);
        itemMapper.insert(item);
    }

    /** 更新资产：先读后写，既给出明确的 404 语义，也顺带带上 version 走乐观锁 */
    public void update(long id, ItemSaveDTO dto) {
        AssetItemDO item = requireItem(id);
        applyFields(item, dto);
        if (itemMapper.updateById(item) == 0) {
            // 走到这里说明并发场景下被删了（读取时还在），对调用方而言就是不存在
            throw new BizException(ErrorCode.NOT_FOUND, "资产不存在或已删除");
        }
    }

    /** 删除资产（逻辑删除）；删不存在的按业务异常返回而不是静默成功 */
    public void delete(long id) {
        if (itemMapper.deleteById(id) == 0) {
            throw new BizException(ErrorCode.NOT_FOUND, "资产不存在或已删除");
        }
    }

    /**
     * 复制计数 +1。用 setSql 原子自增而不是"读出来 +1 再写回"：
     * 后者在并发点同一资产的两次复制会丢一次计数。
     */
    public void incrementCopy(long id) {
        int affected = itemMapper.update(null, new LambdaUpdateWrapper<AssetItemDO>()
                .setSql("copy_count = copy_count + 1")
                .eq(AssetItemDO::getId, id));
        if (affected == 0) {
            throw new BizException(ErrorCode.NOT_FOUND, "资产不存在或已删除");
        }
    }

    /** 读到即返回，读不到统一抛 404（更新/删除共用的存在性语义） */
    private AssetItemDO requireItem(long id) {
        AssetItemDO item = itemMapper.selectById(id);
        if (item == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "资产不存在或已删除");
        }
        return item;
    }

    /** 新增/更新共用的字段映射，两处写一遍迟早漂移 */
    private void applyFields(AssetItemDO item, ItemSaveDTO dto) {
        item.setName(dto.getName());
        item.setType(dto.getType());
        item.setLang(trimToNull(dto.getLang()));
        item.setDescription(trimToNull(dto.getDescription()));
        item.setContent(dto.getContent());
        item.setTags(normalizeTags(dto.getTags()));
    }

    /**
     * 标签规范化：逗号分隔 → trim → 小写 → 去重 → 重新拼接。
     * 小写化让 "Vue" 与 "vue" 不会变成两个筛选项；空串统一存 "" 方便 FIND_IN_SET。
     */
    private String normalizeTags(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        List<String> seen = new ArrayList<>();
        for (String part : raw.split(",")) {
            String tag = part.trim().toLowerCase();
            if (!tag.isEmpty() && !seen.contains(tag)) {
                seen.add(tag);
            }
        }
        if (seen.size() > MAX_TAGS) {
            throw new BizException(ErrorCode.BAD_PARAM, "标签最多 " + MAX_TAGS + " 个");
        }
        return String.join(",", seen);
    }

    private String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
