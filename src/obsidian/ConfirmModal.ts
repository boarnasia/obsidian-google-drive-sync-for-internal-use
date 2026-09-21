import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";

/**
 * 取り消しの利かない操作の前に、件数を読ませてから押させる。
 *
 * 一括削除だけに出す。1 件ずつの削除には出さない——ゴミ箱から戻せる上に、毎回
 * 確認を挟むと読まずに押すようになり、肝心の一括削除でも読まれなくなる。
 */
export class ConfirmModal extends Modal {
  constructor(
    app: App,
    private readonly opts: { title: string; body: string; confirm: string; onConfirm: () => void }
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.opts.title);
    this.contentEl.createEl("p", { text: this.opts.body });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t.btnCancel).onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText(this.opts.confirm)
          .setDestructive()
          .onClick(() => {
            this.close();
            this.opts.onConfirm();
          })
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
