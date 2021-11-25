import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GeoJSON } from 'geojson';

type WCSConfig = {
  scale?: number;
  offset?: number;
  pixelResolution?: number;
};

export type AlertConfig = {
  type: string;
  serverLayerName: string;
  baseUrl: string;
  wcsConfig: WCSConfig;
};

@Entity()
export class Alert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  prismUrl: string;

  @Column({ nullable: true })
  alertName?: string;

  @Column({ type: 'jsonb' })
  alertConfig: AlertConfig;

  @Column({ nullable: true })
  min?: number;

  @Column({ nullable: true })
  max?: number;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  zones?: GeoJSON;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastTriggered?: Date;

  @Column({ nullable: false, default: true })
  active: boolean = true;
}
