import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ModuleNotice({ title, description, children }) {
  return (
    <Card className="shadow-[0_16px_40px_rgba(85,43,65,0.05)]">
      <CardHeader>
        <div className="mb-3">
          <Badge variant="secondary">Foundation ready</Badge>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="max-w-2xl leading-6">{description}</CardDescription>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  )
}
