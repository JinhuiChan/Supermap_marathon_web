import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouteDeleteDialog } from "./RouteDeleteDialog";

describe("RouteDeleteDialog", () => {
  it("explains the destructive action and how to recover", () => {
    const html = renderToStaticMarkup(
      <RouteDeleteDialog
        routeName="测试路线"
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("删除这条路线？");
    expect(html).toContain("测试路线");
    expect(html).toContain("删除后可使用原控制点重新生成。");
    expect(html).toContain(">取消</button>");
    expect(html).toContain(">确认删除</button>");
  });
});
