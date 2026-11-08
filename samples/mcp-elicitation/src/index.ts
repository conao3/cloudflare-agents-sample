import {
  acceptedContent,
  createRequestStateCodec,
  inputRequired,
  inputResponse,
  McpServer,
  type CallToolResult,
  type InputRequiredResult,
  type RequestStateCodec,
} from "@modelcontextprotocol/server"
import { createMcpHandler } from "agents/mcp/server"
import * as z from "zod"

const sizes = ["small", "medium", "large"] as const

const orderSchema = z.object({
  name: z.string().min(1),
  size: z.enum(sizes),
  cups: z.number().int().min(1).max(10),
  oatMilk: z.boolean().optional(),
})

const confirmSchema = z.object({ confirm: z.boolean() })

type Order = z.infer<typeof orderSchema>

type OrderState =
  | { step: "details"; note: string }
  | { step: "confirm"; note: string; order: Order }

const text = (value: string): CallToolResult => ({ content: [{ type: "text", text: value }] })

const cancelled = () => text("Order cancelled.")

const describe = (order: Order) =>
  `${order.cups} ${order.size} coffee${order.cups === 1 ? "" : "s"}${order.oatMilk === true ? " with oat milk" : ""} for ${order.name}`

const createServer = (codec: RequestStateCodec<OrderState>) => {
  const server = new McpServer(
    { name: "cfas-mcp-elicitation", version: "1.0.0" },
    { requestState: { verify: (state, ctx) => codec.verify(state, ctx) } },
  )
  server.registerTool(
    "order_coffee",
    {
      description:
        "Order coffee. Asks the user for the order details, then for a confirmation, in two elicitation rounds",
      inputSchema: { note: z.string().default("") },
    },
    async ({ note }, context): Promise<CallToolResult | InputRequiredResult> => {
      const state = context.mcpReq.requestState<OrderState>()
      if (state === undefined) {
        return inputRequired({
          inputRequests: {
            details: inputRequired.elicit({
              message: "What would you like to order?",
              requestedSchema: {
                type: "object",
                properties: {
                  name: { type: "string", title: "Name on the cup" },
                  size: { type: "string", title: "Size", enum: [...sizes] },
                  cups: {
                    type: "number",
                    title: "Cups",
                    description: "1 to 10",
                    minimum: 1,
                    maximum: 10,
                  },
                  oatMilk: { type: "boolean", title: "Oat milk" },
                },
                required: ["name", "size", "cups"],
              },
            }),
          },
          requestState: await codec.mint({ step: "details", note }, context),
        })
      }
      if (state.step === "details") {
        const response = inputResponse(context.mcpReq.inputResponses, "details")
        if (response.kind === "elicit" && response.action !== "accept") return cancelled()
        const order = acceptedContent(context.mcpReq.inputResponses, "details", orderSchema)
        if (order === undefined) return text("The order details were not valid.")
        return inputRequired({
          inputRequests: {
            confirm: inputRequired.elicit({
              message: `Place the order: ${describe(order)}?`,
              requestedSchema: {
                type: "object",
                properties: { confirm: { type: "boolean", title: "Place the order" } },
                required: ["confirm"],
              },
            }),
          },
          requestState: await codec.mint({ step: "confirm", note: state.note, order }, context),
        })
      }
      const response = inputResponse(context.mcpReq.inputResponses, "confirm")
      if (response.kind === "elicit" && response.action !== "accept") return cancelled()
      const confirmation = acceptedContent(context.mcpReq.inputResponses, "confirm", confirmSchema)
      if (confirmation?.confirm !== true) return cancelled()
      return text(
        `Ordered ${describe(state.order)}.${state.note === "" ? "" : ` Note: ${state.note}`}`,
      )
    },
  )
  return server
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const codec = createRequestStateCodec<OrderState>({
      key: env.MRTR_REQUEST_STATE_KEY,
      bind: ({ mcpReq }) => mcpReq.method,
    })
    const hostname = new URL(request.url).hostname
    return createMcpHandler(() => createServer(codec), {
      route: "/elicit/mcp",
      legacy: "reject",
      allowedHostnames: [hostname],
      allowedOriginHostnames: [hostname],
    })(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
