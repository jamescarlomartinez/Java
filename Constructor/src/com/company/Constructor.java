package com.company;

public class Constructor {
    int num1 = 30;
    int num2 = 20;

    Constructor()
    {
        System.out.println("this is constructor");
    }

    public void display()
    {
        System.out.println("the value of num1 is " + num1);
        System.out.println("the value of num2 is " + num2);
    }

    public static void main(String[] args) {
        Constructor con = new Constructor();
        con.display();
    }
}
