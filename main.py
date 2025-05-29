from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi import Path
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session
import pandas as pd
import json
import io
from datetime import datetime
from typing import List, Dict
import os
import google.generativeai as genai

from models import Transaction, Category, BankStatement
from database import get_db, SessionLocal, engine, Base

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
Base.metadata.create_all(bind=engine)

# Initialize gemini api
genai.configure(api_key=os.getenv("GEMINI_API_KEY", "AIzaSyCfD2DsUkUj35Up0l9-hDZzZbHxPK2ZGCQ"))
model = genai.GenerativeModel('gemini-2.5-flash')
def process_csv_data(file_content):
    try:
        df = pd.read_csv(io.StringIO(file_content.decode('utf-8')))
        # Clean column names
        df.columns = [col.strip() for col in df.columns]
        # Clean and convert amount
        df['Amount'] = df['Amount'].str.replace(',', '').astype(float)
        # Parse date
        df['Date'] = pd.to_datetime(df['Date'], format='%d %b %Y')
        # Clean details
        df['Details'] = df['Details'].str.strip()
        
        return df
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {str(e)}")

def auto_categorize_transactions(details, categories):
    details_lower = details.lower()

    for category in categories:
        if category.keywords:
            keywords = json.loads(category.keywords)
            for keyword in keywords:
                if keyword.lower() in details.lower():
                    return category.id
    uncategorized = next((i for i in categories if i.name == "Uncategorized"), None)
    return uncategorized.id if uncategorized else None

@app.post("/upload-csv/")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail='File must be csv')
    
    content = await file.read()
    df = process_csv_data(content)
    statement = BankStatement(
        filename = file.filename,
        total_transactions = len(df)
    )
    db.add(statement)
    db.commit()

    uncategorized = db.query(Category).filter(Category.name == 'Uncategorized').first()
    if not uncategorized:
        uncategorized = Category(name='Uncategorized', keywords='[]')
        db.add(uncategorized)
        db.commit()
    categories = db.query(Category).all()

    transactions_added = 0

    for col, row in df.iterrows():
        category_id = auto_categorize_transactions(row['Details'], categories)
        transaction = Transaction(
            date=row['Date'].date(),
            details=row['Details'],
            amount=row['Amount'],
            transaction_type=row['Debit/Credit'],
            category_id=category_id or uncategorized.id
        )
        db.add(transaction)
        transactions_added += 1
    db.commit()
    statement.processed = True
    db.commit()

    return {
        "message": f"Successfully processed {transactions_added} transactions",
        "statement_id": statement.id
    }

@app.get("/transactions/")
def get_transactions(transaction_type: str = None, db: Session=Depends(get_db)):
    """Get all transactions, optionally filtered by type"""
    query = db.query(Transaction)
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)
    
    transactions = query.all()
    
    result = []
    for t in transactions:
        result.append({
            "id": t.id,
            "date": t.date.strftime("%Y-%m-%d"),
            "details": t.details,
            "amount": t.amount,
            "transaction_type": t.transaction_type,
            "category": t.category.name if t.category else "Uncategorized"
        })
    return result
@app.delete("/transactions/{transaction_id}/")
def delete_transaction(transaction_id: int = Path(...), db: Session = Depends(get_db)):
    """Delete a transaction by ID"""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    db.delete(transaction)
    db.commit()
    
    return {"message": f"Transaction with ID {transaction_id} deleted successfully"}
@app.delete("/transactions/")
def delete_all_transactions(db: Session = Depends(get_db)):
    """Delete all transactions"""
    deleted = db.query(Transaction).delete()  # deletes all rows
    db.commit()
    return {"deleted_count": deleted}
@app.get("/transactions/summary/")
def get_transaction_summary(db: Session = Depends(get_db)):
    """Get transaction summary by category"""
    debits = db.query(Transaction).filter(Transaction.transaction_type == "Debit").all()
    
    category_totals = {}
    for transaction in debits:
        category_name = transaction.category.name if transaction.category else "Uncategorized"
        if category_name not in category_totals:
            category_totals[category_name] = 0
        category_totals[category_name] += transaction.amount
    
    # Convert to list of dicts for frontend
    summary = [{"category": k, "amount": v} for k, v in category_totals.items()]
    summary.sort(key=lambda x: x["amount"], reverse=True)
    
    return summary

@app.post("/categories/")
def create_category(name: str, db: Session = Depends(get_db)):
    """Create new category"""
    existing = db.query(Category).filter(Category.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    
    category = Category(name=name, keywords="[]")
    db.add(category)
    db.commit()
    
    return {"message": f"Category '{name}' created successfully"}

@app.get("/categories/")
def get_categories(db: Session = Depends(get_db)):
    """Get all categories"""
    categories = db.query(Category).all()
    return [{"id": c.id, "name": c.name} for c in categories]

@app.put("/transactions/{transaction_id}/category/")
def update_transaction_category(
    transaction_id: int, 
    category_name: str, 
    db: Session = Depends(get_db)
):
    """Update transaction category and add keyword"""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Update transaction category
    transaction.category_id = category.id
    
    # Add transaction details as keyword to category
    keywords = json.loads(category.keywords) if category.keywords else []
    if transaction.details not in keywords:
        keywords.append(transaction.details)
        category.keywords = json.dumps(keywords)
    
    db.commit()
    
    return {"message": "Transaction category updated successfully"}

@app.get("/insights/")
async def get_ai_insights(db: Session = Depends(get_db)):
    """Get AI-powered spending insights"""
    try:
        # Get expense summary
        debits = db.query(Transaction).filter(Transaction.transaction_type == "Debit").all()
        
        total_spent = sum(t.amount for t in debits)
        category_spending = {}
        
        for transaction in debits:
            category = transaction.category.name if transaction.category else "Uncategorized"
            category_spending[category] = category_spending.get(category, 0) + transaction.amount
        
        # Create prompt for AI
        spending_data = {
            "total_spending": total_spent,
            "category_breakdown": category_spending,
            "transaction_count": len(debits)
        }
        
        prompt = f"""
        Analyze this spending data and provide insights in JSON format:
        {spending_data}
        
        Please provide a JSON response with:
        1. "summary": Brief overview of spending patterns
        2. "top_categories": List of highest spending categories
        3. "suggestions": 3 practical suggestions for better budgeting
        4. "alerts": Any concerning spending patterns
        
        Keep response concise and actionable.
        """
        
        response = model.generate_content(prompt)
        
        return {
            "insights": response.text,
            "spending_data": spending_data
        }
        
    except Exception as e:
        return {
            "insights": "AI insights temporarily unavailable",
            "error": str(e),
            "spending_data": {"total_spending": 0}
        }
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)