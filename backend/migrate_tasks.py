#!/usr/bin/env python3
"""
Database migration script for Task Tracker enhancement
Adds priority and due_date columns to existing tasks table
"""
import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/superdashboard")
engine = create_engine(DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        # Check if tasks table exists
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'tasks'
            );
        """))
        table_exists = result.scalar()
        
        if not table_exists:
            print("Tasks table doesn't exist yet. It will be created on first run.")
            return
        
        # Check if priority column exists
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'tasks' AND column_name = 'priority'
            );
        """))
        priority_exists = result.scalar()
        
        if not priority_exists:
            print("Adding priority column to tasks table...")
            conn.execute(text("""
                ALTER TABLE tasks 
                ADD COLUMN priority VARCHAR NOT NULL DEFAULT 'medium';
            """))
            conn.commit()
            print("✓ Priority column added")
        else:
            print("✓ Priority column already exists")
        
        # Check if due_date column exists
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'tasks' AND column_name = 'due_date'
            );
        """))
        due_date_exists = result.scalar()
        
        if not due_date_exists:
            print("Adding due_date column to tasks table...")
            conn.execute(text("""
                ALTER TABLE tasks 
                ADD COLUMN due_date TIMESTAMP;
            """))
            conn.commit()
            print("✓ Due date column added")
        else:
            print("✓ Due date column already exists")
        
        print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"❌ Migration failed: {e}", file=sys.stderr)
        sys.exit(1)
