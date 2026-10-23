import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

@Controller()
@ApiTags("System")
export class AppController {
  @Get("health")
  @ApiOperation({
    summary: "Check backend health",
    description:
      "Returns a simple response when the backend process is running.",
  })
  health(): { status: string } {
    return { status: "ok" };
  }
}
