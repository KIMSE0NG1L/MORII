"use client";

import { useState } from "react";
import { deleteAccount } from "./actions";

export function DeleteAccountModal() {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteAccount();
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-btn w-full bg-[#fbe9e4] py-2 text-sm text-[#b23c26]"
      >
        회원탈퇴
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-panel p-6 w-full max-w-sm z-50">
        <h2 className="text-lg font-bold text-ink mb-2">정말 탈퇴하시겠어요?</h2>
        <p className="text-sm text-muted mb-6">
          회원탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => setOpen(false)}
            disabled={isDeleting}
            className="px-btn px-btn-cream flex-1 py-2 text-sm"
          >
            취소
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-btn px-btn-danger flex-1 py-2 text-sm"
          >
            {isDeleting ? "탈퇴 중..." : "탈퇴"}
          </button>
        </div>
      </div>
    </>
  );
}
