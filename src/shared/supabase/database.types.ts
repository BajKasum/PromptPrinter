
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "billing_events": {
                  Row: {
                    "created_at": string,"detail": string | null,"event_key": string,"event_name": string,"id": string,"resource_id": string | null,"status": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"detail"?: string | null,"event_key": string,"event_name": string,"id"?: string,"resource_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"detail"?: string | null,"event_key"?: string,"event_name"?: string,"id"?: string,"resource_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"cli_device_requests": {
                  Row: {
                    "client_name": string,"created_at": string,"device_code_hash": string,"expires_at": string,"id": string,"last_polled_at": string | null,"request_ip": string | null,"request_location": string | null,"request_user_agent": string | null,"status": string,"user_code": string,"user_id": string | null
                  }
                  Insert: {
                    "client_name"?: string,"created_at"?: string,"device_code_hash": string,"expires_at"?: string,"id"?: string,"last_polled_at"?: string | null,"request_ip"?: string | null,"request_location"?: string | null,"request_user_agent"?: string | null,"status"?: string,"user_code": string,"user_id"?: string | null
                  }
                  Update: {
                    "client_name"?: string,"created_at"?: string,"device_code_hash"?: string,"expires_at"?: string,"id"?: string,"last_polled_at"?: string | null,"request_ip"?: string | null,"request_location"?: string | null,"request_user_agent"?: string | null,"status"?: string,"user_code"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"cli_sessions": {
                  Row: {
                    "client_name": string,"created_at": string,"expires_at": string,"last_used_at": string,"session_id": string,"user_id": string
                  }
                  Insert: {
                    "client_name"?: string,"created_at"?: string,"expires_at": string,"last_used_at"?: string,"session_id": string,"user_id": string
                  }
                  Update: {
                    "client_name"?: string,"created_at"?: string,"expires_at"?: string,"last_used_at"?: string,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"id": string,"project_id": string | null,"title": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"project_id"?: string | null,"title"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"project_id"?: string | null,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"message_attachments": {
                  Row: {
                    "conversation_id": string,"created_at": string,"id": string,"kind": string,"media_type": string,"message_id": string,"name": string,"size_bytes": number,"storage_path": string,"user_id": string
                  }
                  Insert: {
                    "conversation_id": string,"created_at"?: string,"id"?: string,"kind": string,"media_type": string,"message_id": string,"name": string,"size_bytes": number,"storage_path": string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"media_type"?: string,"message_id"?: string,"name"?: string,"size_bytes"?: number,"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_attachments_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_attachments_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_attachments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"id": string,"role": string,"user_id": string
                  }
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"role": string,"user_id": string
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mfa_recovery_codes": {
                  Row: {
                    "code_hash": string,"created_at": string,"id": string,"used_at": string | null,"user_id": string
                  }
                  Insert: {
                    "code_hash": string,"created_at"?: string,"id"?: string,"used_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "code_hash"?: string,"created_at"?: string,"id"?: string,"used_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "about_me": string,"avatar_url": string | null,"created_at": string,"display_name": string | null,"id": string,"is_admin": boolean,"plan": string,"settings": NonNullable<Json>,"subscription_customer_id": string | null,"subscription_ends_at": string | null,"subscription_id": string | null,"subscription_portal_url": string | null,"subscription_renews_at": string | null,"subscription_status": string | null,"updated_at": string
                  }
                  Insert: {
                    "about_me"?: string,"avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id": string,"is_admin"?: boolean,"plan"?: string,"settings"?: NonNullable<Json>,"subscription_customer_id"?: string | null,"subscription_ends_at"?: string | null,"subscription_id"?: string | null,"subscription_portal_url"?: string | null,"subscription_renews_at"?: string | null,"subscription_status"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "about_me"?: string,"avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"is_admin"?: boolean,"plan"?: string,"settings"?: NonNullable<Json>,"subscription_customer_id"?: string | null,"subscription_ends_at"?: string | null,"subscription_id"?: string | null,"subscription_portal_url"?: string | null,"subscription_renews_at"?: string | null,"subscription_status"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_brains": {
                  Row: {
                    "analyzed_at": string | null,"created_at": string,"error_code": string | null,"facts": NonNullable<Json>,"model": string | null,"project_id": string,"repo_ref": string | null,"repo_url": string | null,"source_digest": string | null,"sources": NonNullable<Json>,"status": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "analyzed_at"?: string | null,"created_at"?: string,"error_code"?: string | null,"facts"?: NonNullable<Json>,"model"?: string | null,"project_id": string,"repo_ref"?: string | null,"repo_url"?: string | null,"source_digest"?: string | null,"sources"?: NonNullable<Json>,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "analyzed_at"?: string | null,"created_at"?: string,"error_code"?: string | null,"facts"?: NonNullable<Json>,"model"?: string | null,"project_id"?: string,"repo_ref"?: string | null,"repo_url"?: string | null,"source_digest"?: string | null,"sources"?: NonNullable<Json>,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_brains_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_brains_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"project_files": {
                  Row: {
                    "created_at": string,"id": string,"mime": string | null,"name": string,"project_id": string,"size_bytes": number,"storage_path": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"mime"?: string | null,"name": string,"project_id": string,"size_bytes": number,"storage_path": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"mime"?: string | null,"name"?: string,"project_id"?: string,"size_bytes"?: number,"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_files_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_files_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "audience": string | null,"context": NonNullable<Json>,"created_at": string,"id": string,"idea": string | null,"instructions": string | null,"is_favorite": boolean,"name": string,"tools": Json | null,"type": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "audience"?: string | null,"context"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"idea"?: string | null,"instructions"?: string | null,"is_favorite"?: boolean,"name": string,"tools"?: Json | null,"type"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "audience"?: string | null,"context"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"idea"?: string | null,"instructions"?: string | null,"is_favorite"?: boolean,"name"?: string,"tools"?: Json | null,"type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"prompt_shares": {
                  Row: {
                    "created_at": string,"prompt_id": string,"token": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"prompt_id": string,"token": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"prompt_id"?: string,"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prompt_shares_prompt_owner_fkey"
      columns: ["prompt_id","user_id"]
isOneToOne: false
      referencedRelation: "saved_prompts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "prompt_shares_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_prompts": {
                  Row: {
                    "created_at": string,"id": string,"outputs": NonNullable<Json>,"project_id": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"outputs": NonNullable<Json>,"project_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"outputs"?: NonNullable<Json>,"project_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_prompts_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_prompts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"security_events": {
                  Row: {
                    "created_at": string,"details": NonNullable<Json>,"event": string,"id": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"event": string,"id"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"event"?: string,"id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"user_api_keys": {
                  Row: {
                    "base_url": string | null,"created_at": string,"encrypted_key": string,"id": string,"is_active": boolean,"label": string | null,"model": string | null,"provider": string,"user_id": string
                  }
                  Insert: {
                    "base_url"?: string | null,"created_at"?: string,"encrypted_key": string,"id"?: string,"is_active"?: boolean,"label"?: string | null,"model"?: string | null,"provider": string,"user_id": string
                  }
                  Update: {
                    "base_url"?: string | null,"created_at"?: string,"encrypted_key"?: string,"id"?: string,"is_active"?: boolean,"label"?: string | null,"model"?: string | null,"provider"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_api_keys_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "attachment_bytes_used":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"end_cli_session":
{ Args: { "target_session": string,"target_user": string }; Returns: boolean
                           },
"project_summaries":
{ Args: Record<PropertyKey, never>; Returns: {
              "chat_count": number,"project_id": string,"saved_count": number
            }[]
                           },
"prune_cli_login":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"prune_security_events":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"set_active_byok_provider_for":
{ Args: { "target_provider": string,"target_user": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
