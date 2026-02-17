export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campaigns: {
        Row: {
          created_at: string
          current_act: number | null
          description: string | null
          id: string
          level_range: string | null
          name: string
          narrative_context: Json | null
          region: string | null
          setting: string | null
          status: string | null
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_act?: number | null
          description?: string | null
          id?: string
          level_range?: string | null
          name: string
          narrative_context?: Json | null
          region?: string | null
          setting?: string | null
          status?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_act?: number | null
          description?: string | null
          id?: string
          level_range?: string | null
          name?: string
          narrative_context?: Json | null
          region?: string | null
          setting?: string | null
          status?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      encounters: {
        Row: {
          campaign_id: string | null
          created_at: string
          criaturas_json: Json | null
          dificultad: number
          estrategia_json: Json | null
          fecha_creacion: string
          id: string
          mission_id: string | null
          nivel_grupo: number
          numero_personajes: number
          tags: string[] | null
          texto_completo_editable: string
          tipo: string
          updated_at: string
          user_id: string
          xp_total: number | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          criaturas_json?: Json | null
          dificultad: number
          estrategia_json?: Json | null
          fecha_creacion?: string
          id?: string
          mission_id?: string | null
          nivel_grupo: number
          numero_personajes: number
          tags?: string[] | null
          texto_completo_editable: string
          tipo?: string
          updated_at?: string
          user_id: string
          xp_total?: number | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          criaturas_json?: Json | null
          dificultad?: number
          estrategia_json?: Json | null
          fecha_creacion?: string
          id?: string
          mission_id?: string | null
          nivel_grupo?: number
          numero_personajes?: number
          tags?: string[] | null
          texto_completo_editable?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          xp_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "encounters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "misiones"
            referencedColumns: ["id"]
          },
        ]
      }
      escenas: {
        Row: {
          conflicto_central: string | null
          consecuencias_inmediatas: string | null
          created_at: string
          criaturas_involucradas: Json | null
          descripcion_narrativa: string | null
          detonante: string | null
          giro_inesperado: string | null
          id: string
          localizacion: string | null
          mission_id: string | null
          nivel_recomendado: string | null
          notas_dm: string | null
          pnj_involucrados: Json | null
          posibles_resoluciones: Json | null
          tags: string[] | null
          tipo: string | null
          titulo: string
          tono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conflicto_central?: string | null
          consecuencias_inmediatas?: string | null
          created_at?: string
          criaturas_involucradas?: Json | null
          descripcion_narrativa?: string | null
          detonante?: string | null
          giro_inesperado?: string | null
          id?: string
          localizacion?: string | null
          mission_id?: string | null
          nivel_recomendado?: string | null
          notas_dm?: string | null
          pnj_involucrados?: Json | null
          posibles_resoluciones?: Json | null
          tags?: string[] | null
          tipo?: string | null
          titulo: string
          tono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conflicto_central?: string | null
          consecuencias_inmediatas?: string | null
          created_at?: string
          criaturas_involucradas?: Json | null
          descripcion_narrativa?: string | null
          detonante?: string | null
          giro_inesperado?: string | null
          id?: string
          localizacion?: string | null
          mission_id?: string | null
          nivel_recomendado?: string | null
          notas_dm?: string | null
          pnj_involucrados?: Json | null
          posibles_resoluciones?: Json | null
          tags?: string[] | null
          tipo?: string | null
          titulo?: string
          tono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escenas_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "misiones"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_content: {
        Row: {
          campaign_id: string | null
          content_type: string
          created_at: string
          editable_text: string
          id: string
          metadata: Json | null
          mission_id: string | null
          narrative_hooks: Json | null
          relationships: Json | null
          reusable_elements: Json | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          content_type: string
          created_at?: string
          editable_text: string
          id?: string
          metadata?: Json | null
          mission_id?: string | null
          narrative_hooks?: Json | null
          relationships?: Json | null
          reusable_elements?: Json | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          content_type?: string
          created_at?: string
          editable_text?: string
          id?: string
          metadata?: Json | null
          mission_id?: string | null
          narrative_hooks?: Json | null
          relationships?: Json | null
          reusable_elements?: Json | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_content_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_content_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "misiones"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_ia: {
        Row: {
          created_at: string
          detalles: string | null
          id: string
          proveedor: string
          tipo_error: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detalles?: string | null
          id?: string
          proveedor: string
          tipo_error: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detalles?: string | null
          id?: string
          proveedor?: string
          tipo_error?: string
          user_id?: string | null
        }
        Relationships: []
      }
      misiones: {
        Row: {
          actos_o_fases: Json | null
          conflicto_central: string | null
          consecuencias_potenciales: Json | null
          contenido: string | null
          contexto_general: string | null
          created_at: string
          descripcion: string | null
          detonante: string | null
          estado: string
          eventos_dinamicos: string[] | null
          facciones_involucradas: string[] | null
          giros_argumentales: Json | null
          id: string
          linked_missions_ids: string[] | null
          metadata: Json | null
          mission_parent_id: string | null
          nivel_recomendado: string | null
          objeto_clave: string[] | null
          pnj_clave: string[] | null
          posibles_rutas: Json | null
          recompensas_sugeridas: Json | null
          riesgos_escalada: string[] | null
          secretos_ocultos: string[] | null
          sububicaciones: string[] | null
          tags: string[] | null
          tipo: string | null
          titulo: string | null
          tono: string | null
          trama_detallada: string | null
          ubicacion_principal: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actos_o_fases?: Json | null
          conflicto_central?: string | null
          consecuencias_potenciales?: Json | null
          contenido?: string | null
          contexto_general?: string | null
          created_at?: string
          descripcion?: string | null
          detonante?: string | null
          estado?: string
          eventos_dinamicos?: string[] | null
          facciones_involucradas?: string[] | null
          giros_argumentales?: Json | null
          id?: string
          linked_missions_ids?: string[] | null
          metadata?: Json | null
          mission_parent_id?: string | null
          nivel_recomendado?: string | null
          objeto_clave?: string[] | null
          pnj_clave?: string[] | null
          posibles_rutas?: Json | null
          recompensas_sugeridas?: Json | null
          riesgos_escalada?: string[] | null
          secretos_ocultos?: string[] | null
          sububicaciones?: string[] | null
          tags?: string[] | null
          tipo?: string | null
          titulo?: string | null
          tono?: string | null
          trama_detallada?: string | null
          ubicacion_principal?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actos_o_fases?: Json | null
          conflicto_central?: string | null
          consecuencias_potenciales?: Json | null
          contenido?: string | null
          contexto_general?: string | null
          created_at?: string
          descripcion?: string | null
          detonante?: string | null
          estado?: string
          eventos_dinamicos?: string[] | null
          facciones_involucradas?: string[] | null
          giros_argumentales?: Json | null
          id?: string
          linked_missions_ids?: string[] | null
          metadata?: Json | null
          mission_parent_id?: string | null
          nivel_recomendado?: string | null
          objeto_clave?: string[] | null
          pnj_clave?: string[] | null
          posibles_rutas?: Json | null
          recompensas_sugeridas?: Json | null
          riesgos_escalada?: string[] | null
          secretos_ocultos?: string[] | null
          sububicaciones?: string[] | null
          tags?: string[] | null
          tipo?: string | null
          titulo?: string | null
          tono?: string | null
          trama_detallada?: string | null
          ubicacion_principal?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "misiones_mission_parent_id_fkey"
            columns: ["mission_parent_id"]
            isOneToOne: false
            referencedRelation: "misiones"
            referencedColumns: ["id"]
          },
        ]
      }
      npcs: {
        Row: {
          acciones: string | null
          acciones_guarida: string | null
          acciones_legendarias: string | null
          alineamiento: string | null
          atributos: Json | null
          ca: number | null
          clase_arquetipo: string | null
          competencias: string | null
          contenido_completo: string | null
          created_at: string
          equipo: string | null
          facciones: string | null
          habilidades: string | null
          historia_lore: string | null
          hp: string | null
          id: string
          idiomas: string | null
          importancia: string | null
          localizacion: string | null
          mission_id: string | null
          motivaciones: string | null
          nivel: string | null
          nombre: string
          rasgos_especiales: string | null
          raza: string | null
          reacciones: string | null
          resistencias_inmunidades: string | null
          rol: string | null
          secretos: string | null
          sentidos: string | null
          tags: string[] | null
          trasfondo: string | null
          updated_at: string
          user_id: string
          velocidad: string | null
        }
        Insert: {
          acciones?: string | null
          acciones_guarida?: string | null
          acciones_legendarias?: string | null
          alineamiento?: string | null
          atributos?: Json | null
          ca?: number | null
          clase_arquetipo?: string | null
          competencias?: string | null
          contenido_completo?: string | null
          created_at?: string
          equipo?: string | null
          facciones?: string | null
          habilidades?: string | null
          historia_lore?: string | null
          hp?: string | null
          id?: string
          idiomas?: string | null
          importancia?: string | null
          localizacion?: string | null
          mission_id?: string | null
          motivaciones?: string | null
          nivel?: string | null
          nombre: string
          rasgos_especiales?: string | null
          raza?: string | null
          reacciones?: string | null
          resistencias_inmunidades?: string | null
          rol?: string | null
          secretos?: string | null
          sentidos?: string | null
          tags?: string[] | null
          trasfondo?: string | null
          updated_at?: string
          user_id: string
          velocidad?: string | null
        }
        Update: {
          acciones?: string | null
          acciones_guarida?: string | null
          acciones_legendarias?: string | null
          alineamiento?: string | null
          atributos?: Json | null
          ca?: number | null
          clase_arquetipo?: string | null
          competencias?: string | null
          contenido_completo?: string | null
          created_at?: string
          equipo?: string | null
          facciones?: string | null
          habilidades?: string | null
          historia_lore?: string | null
          hp?: string | null
          id?: string
          idiomas?: string | null
          importancia?: string | null
          localizacion?: string | null
          mission_id?: string | null
          motivaciones?: string | null
          nivel?: string | null
          nombre?: string
          rasgos_especiales?: string | null
          raza?: string | null
          reacciones?: string | null
          resistencias_inmunidades?: string | null
          rol?: string | null
          secretos?: string | null
          sentidos?: string | null
          tags?: string[] | null
          trasfondo?: string | null
          updated_at?: string
          user_id?: string
          velocidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "npcs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "misiones"
            referencedColumns: ["id"]
          },
        ]
      }
      objetos_magicos: {
        Row: {
          alineamiento_restringido: string | null
          bonificadores: string | null
          cargas: string | null
          categoria_artefacto: string | null
          clase_restringida: string | null
          condiciones_de_desbloqueo: string | null
          contenido_completo: string | null
          creador_original: string | null
          created_at: string
          crecimiento_escalable: boolean
          efectos_secundarios: string | null
          es_artefacto: boolean
          forma_de_recarga: string | null
          ganchos_narrativos: string | null
          habilidades_activas: string | null
          habilidades_pasivas: string | null
          historia_lore: string | null
          id: string
          maldiciones: string | null
          mission_id: string | null
          nivel_recomendado: string | null
          nombre: string
          notas_dm: string | null
          origen: string | null
          propiedades_magicas: string | null
          rareza: string
          region: string | null
          requiere_sintonizacion: boolean
          rol_objeto: string | null
          rumores_asociados: string | null
          subtipo: string | null
          tags: string[] | null
          tipo: string
          tono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alineamiento_restringido?: string | null
          bonificadores?: string | null
          cargas?: string | null
          categoria_artefacto?: string | null
          clase_restringida?: string | null
          condiciones_de_desbloqueo?: string | null
          contenido_completo?: string | null
          creador_original?: string | null
          created_at?: string
          crecimiento_escalable?: boolean
          efectos_secundarios?: string | null
          es_artefacto?: boolean
          forma_de_recarga?: string | null
          ganchos_narrativos?: string | null
          habilidades_activas?: string | null
          habilidades_pasivas?: string | null
          historia_lore?: string | null
          id?: string
          maldiciones?: string | null
          mission_id?: string | null
          nivel_recomendado?: string | null
          nombre: string
          notas_dm?: string | null
          origen?: string | null
          propiedades_magicas?: string | null
          rareza?: string
          region?: string | null
          requiere_sintonizacion?: boolean
          rol_objeto?: string | null
          rumores_asociados?: string | null
          subtipo?: string | null
          tags?: string[] | null
          tipo?: string
          tono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alineamiento_restringido?: string | null
          bonificadores?: string | null
          cargas?: string | null
          categoria_artefacto?: string | null
          clase_restringida?: string | null
          condiciones_de_desbloqueo?: string | null
          contenido_completo?: string | null
          creador_original?: string | null
          created_at?: string
          crecimiento_escalable?: boolean
          efectos_secundarios?: string | null
          es_artefacto?: boolean
          forma_de_recarga?: string | null
          ganchos_narrativos?: string | null
          habilidades_activas?: string | null
          habilidades_pasivas?: string | null
          historia_lore?: string | null
          id?: string
          maldiciones?: string | null
          mission_id?: string | null
          nivel_recomendado?: string | null
          nombre?: string
          notas_dm?: string | null
          origen?: string | null
          propiedades_magicas?: string | null
          rareza?: string
          region?: string | null
          requiere_sintonizacion?: boolean
          rol_objeto?: string | null
          rumores_asociados?: string | null
          subtipo?: string | null
          tags?: string[] | null
          tipo?: string
          tono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objetos_magicos_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "misiones"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nickname: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nickname: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_context: {
        Row: {
          id: string
          last_updated: string
          narrative_styles: Json | null
          npcs_created: Json | null
          recent_themes: Json | null
          regions_used: Json | null
          user_id: string
        }
        Insert: {
          id?: string
          last_updated?: string
          narrative_styles?: Json | null
          npcs_created?: Json | null
          recent_themes?: Json | null
          regions_used?: Json | null
          user_id: string
        }
        Update: {
          id?: string
          last_updated?: string
          narrative_styles?: Json | null
          npcs_created?: Json | null
          recent_themes?: Json | null
          regions_used?: Json | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_email_by_nickname: { Args: { p_nickname: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
