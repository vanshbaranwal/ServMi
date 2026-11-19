import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api, getApiError } from "@/lib/api"
import { formatMoney, formatStatus } from "@/lib/formatters"

export function AdminWithdrawalDialog({ withdrawal, targetStatus, onClose, onUpdated }) {
  const [adminNote, setAdminNote] = useState("")
  const [transferReference, setTransferReference] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const provider = withdrawal.userId || {}
  const dialogTitle = targetStatus === "processing"
    ? "Start processing withdrawal"
    : targetStatus === "paid"
      ? "Mark withdrawal paid"
      : "Reject withdrawal"

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (targetStatus === "paid" && transferReference.trim().length < 6) {
      setError("Enter the bank or UPI transfer reference before marking this paid.")
      return
    }
    if (targetStatus === "rejected" && adminNote.trim().length < 3) {
      setError("Add a short reason for rejecting this withdrawal.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const payload = { status: targetStatus }
      if (adminNote.trim()) payload.adminNote = adminNote.trim()
      if (targetStatus === "paid") payload.transferReference = transferReference.trim()
      const { data } = await api.patch(`/api/admin/withdrawals/${withdrawal._id}`, payload)
      onUpdated(data.withdrawal, data.summary)
      toast.success(data.message || `Withdrawal marked ${targetStatus}`)
      onClose()
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't update this withdrawal."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Confirm the supported status change for {provider.businessName || provider.name || "this provider"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-6">
            <div className="grid gap-3 rounded-xl border bg-muted/40 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="mt-1 font-semibold text-foreground">{formatMoney(withdrawal.amount, withdrawal.currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">UPI destination</p>
                <p className="mt-1 break-all font-semibold text-foreground">{withdrawal.payoutSnapshot?.upiId || "Unavailable"}</p>
              </div>
            </div>

            {targetStatus === "paid" && (
              <FormField id="admin-transfer-reference" label="Transfer reference" hint="Required">
                <Input
                  id="admin-transfer-reference"
                  value={transferReference}
                  onChange={(event) => { setTransferReference(event.target.value); setError("") }}
                  placeholder="Bank UTR or UPI reference"
                  autoFocus
                  required
                />
              </FormField>
            )}

            <FormField
              id="admin-withdrawal-note"
              label="Admin note"
              hint={targetStatus === "rejected" ? "Required for rejection" : "Optional"}
            >
              <Textarea
                id="admin-withdrawal-note"
                value={adminNote}
                onChange={(event) => { setAdminNote(event.target.value); setError("") }}
                rows={3}
                placeholder="Internal operational context"
              />
            </FormField>

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant={targetStatus === "rejected" ? "destructive" : "default"} disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {saving ? "Updating" : `Mark ${formatStatus(targetStatus).toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
